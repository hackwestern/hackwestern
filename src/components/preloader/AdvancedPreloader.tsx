"use client";

import { motion, AnimatePresence, useMotionValue, animate, useTransform } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import React from "react";
import { usePreloader } from "../preloader/PreloaderContext";

// ============================================================================
// INTERFACE & TYPES
// ============================================================================

interface NameDropPreloaderProps {
  children: React.ReactNode;
  duration?: number; // Duration in milliseconds (default 700ms like authentic NameDrop)
  onComplete?: () => void;
  debugMode?: boolean;
}

// ============================================================================
// WEBGL SHADER DEFINITIONS
// ============================================================================

const vertexShader = `
  attribute vec2 position;
  varying vec2 vUv;
  
  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision mediump float;
  
  uniform float time;
  uniform float progress;
  uniform vec2 resolution;
  uniform vec2 rippleCenter;
  uniform sampler2D backgroundTexture;
  
  varying vec2 vUv;
  
  // Smooth step function for ripple falloff
  float smoothRipple(float dist, float radius, float thickness) {
    float inner = radius - thickness;
    float outer = radius + thickness;
    return 1.0 - smoothstep(inner, outer, dist);
  }
  
  // Distortion function for liquid wave effect
  vec2 getDistortion(vec2 uv, float rippleTime) {
    vec2 center = rippleCenter;
    float dist = distance(uv, center);
    
    // Create multiple wave rings with different frequencies
    float wave1 = sin(dist * 20.0 - rippleTime * 8.0) * 0.03;
    float wave2 = sin(dist * 35.0 - rippleTime * 12.0) * 0.02;
    float wave3 = sin(dist * 50.0 - rippleTime * 16.0) * 0.01;
    
    // Combine waves with falloff
    float falloff = 1.0 - smoothstep(0.0, 0.8, dist);
    vec2 direction = normalize(uv - center);
    
    float totalWave = (wave1 + wave2 + wave3) * falloff * progress;
    return direction * totalWave;
  }
  
  void main() {
    vec2 uv = vUv;
    vec2 center = rippleCenter;
    float dist = distance(uv, center);
    
    // Calculate ripple animation timing
    float rippleTime = progress * 10.0;
    float rippleRadius = progress * 2.0;
    
    // Get distortion offset
    vec2 distortion = getDistortion(uv, rippleTime);
    vec2 distortedUv = uv + distortion;
    
    // Sample background with distortion
    vec4 background = texture2D(backgroundTexture, distortedUv);
    
    // Create the bright ripple ring
    float ringRadius = rippleRadius * 1.5;
    float ringThickness = 0.05;
    float ring = smoothRipple(dist, ringRadius, ringThickness);
    
    // Create the bright core
    float coreRadius = ringRadius * 0.3;
    float core = 1.0 - smoothstep(0.0, coreRadius, dist);
    
    // Brightness and saturation effects
    float brightnessMult = 1.0 + (ring + core) * 0.5 * progress;
    float saturation = 1.0 - (ring + core) * 0.3 * progress;
    
    // Apply effects to background
    vec3 color = background.rgb * brightnessMult;
    
    // Desaturate (convert to grayscale partially)
    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color = mix(color, vec3(gray), 1.0 - saturation);
    
    // Add the bright white ripple
    color += vec3(ring + core * 0.8) * progress;
    
    // Add subtle color tinting from the background
    vec3 tint = background.rgb * 0.2;
    color += tint * (ring + core) * progress;
    
    // Apply overall fade out
    float alpha = 1.0 - progress * progress;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

// ============================================================================
// WEBGL SHADER COMPONENT
// ============================================================================

interface ShaderCanvasProps {
  progress: number;
  className?: string;
}

function ShaderCanvas({ progress, className }: ShaderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const animationFrameRef = useRef<number>(1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('🔧 WebGL Debug: Canvas not found');
      return;
    }

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.warn('🔧 WebGL Debug: WebGL not supported, falling back to CSS');
      return;
    }

    console.log('🔧 WebGL Debug: Context created successfully');

    glRef.current = gl;

    // Compile shader
    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vertShader = compileShader(vertexShader, gl.VERTEX_SHADER);
    const fragShader = compileShader(fragmentShader, gl.FRAGMENT_SHADER);

    if (!vertShader || !fragShader) {
      console.error('🔧 WebGL Debug: Shader compilation failed');
      return;
    }

    console.log('🔧 WebGL Debug: Shaders compiled successfully');

    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('🔧 WebGL Debug: Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    console.log('🔧 WebGL Debug: Program linked successfully');
    programRef.current = program;

    // Create geometry
    const vertices = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set up render loop
    const render = (time: number) => {
      if (!gl || !program) return;

      gl.viewport(0, 0, canvas.width, canvas.height);
      
      // Enable blending for transparency
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      
      // Clear with transparent background
      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      
      gl.useProgram(program);

      // Set uniforms
      const timeLocation = gl.getUniformLocation(program, 'time');
      const progressLocation = gl.getUniformLocation(program, 'progress');
      const resolutionLocation = gl.getUniformLocation(program, 'resolution');
      const rippleCenterLocation = gl.getUniformLocation(program, 'rippleCenter');

      if (timeLocation) gl.uniform1f(timeLocation, time * 0.001);
      if (progressLocation) gl.uniform1f(progressLocation, progress);
      if (resolutionLocation) gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      if (rippleCenterLocation) gl.uniform2f(rippleCenterLocation, 0.5, 0.0); // Center-top

      // Debug logging every 10th frame
      if (Math.floor(time) % 100 === 0) {
        console.log(`🔧 WebGL Debug: Progress=${progress.toFixed(3)}, Time=${(time*0.001).toFixed(2)}s`);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render(0);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [progress]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        mixBlendMode: 'multiply',
        opacity: progress > 0 ? 0.8 : 0,
      }}
    />
  );
}

// ============================================================================
// MAIN NAMEDROP PRELOADER COMPONENT
// ============================================================================

export default function NameDropPreloader({
  children,
  duration = 1600, // Authentic NameDrop timing
  onComplete,
  debugMode = false,
}: NameDropPreloaderProps) {
  // ============================================================================
  // STATE & ANIMATION VALUES
  // ============================================================================

  const progress = useMotionValue(0); // 0 → 1 (start → peak → finish)
  const [isVisible, setIsVisible] = useState(true);
  const [showShockwave, setShowShockwave] = useState(false);
  const { setShowToolbar } = usePreloader();

  // Derived values for different stages of the animation
  const shockwaveProgress = useTransform(progress, [0, 0.3, 1], [0, 1, 0]);
  const brightnessBoost = useTransform(progress, [0, 0.4, 0.8, 1], [1, 1.2, 1.1, 1]);
  const contentBlur = useTransform(progress, [0, 0.3, 0.7, 1], [0, 15, 8, 0]); // Reduced max blur from 25px to 15px
  const contentOpacity = useTransform(progress, [0, 0.8, 1], [1, 0.5, 1]);
  const contentPush = useTransform(progress, [0, 0.4, 1], [0, 3, 0]); // Subtle push effect

  // ============================================================================
  // ANIMATION ORCHESTRATION
  // ============================================================================

  useEffect(() => {
    if (debugMode) {
      console.log("🌊 NameDrop Animation Starting - Duration:", duration, "ms");
    }

    // Start shockwave immediately (like pin-sized flash)
    setShowShockwave(true);

    // Show toolbar partway through animation while still blurry (at ~40% progress)
    const toolbarTimer = setTimeout(() => {
      setShowToolbar(true);
      if (debugMode) {
        console.log("🔧 Toolbar triggered during blur phase");
      }
    }, duration * 0.6); //80% through the animation

    // Main progress animation
    const progressAnimation = animate(progress, 1, {
      duration: duration / 1000,
      ease: [0.25, 0.46, 0.45, 0.94], // Smooth ease curve
    });

    // Complete and cleanup
    const completionTimer = setTimeout(() => {
      setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, 200); // Quick exit
    }, duration);

    return () => {
      progressAnimation.stop();
      clearTimeout(completionTimer);
      clearTimeout(toolbarTimer);
    };
  }, [duration, onComplete, progress, debugMode, setShowToolbar]);

  return (
    <div className="relative">
      {/* ====================================================================== */}
      {/* CONTENT LAYER - ALWAYS VISIBLE */}
      {/* ====================================================================== */}
      <motion.div
        className="relative"
        style={{
          filter: useTransform(
            [contentBlur, brightnessBoost],
            ([blur, brightness]) => `blur(${blur as number}px) brightness(${brightness as number})`
          ),
          transform: useTransform(contentPush, (push) => `translateY(${push}px)`),
        }}
      >
        {children}
      </motion.div>

      {/* ====================================================================== */}
      {/* NAMEDROP SHOCKWAVE OVERLAY */}
      {/* ====================================================================== */}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="fixed inset-0 z-50 pointer-events-none overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              scale: 1.05,
            }}
            transition={{
              duration: 0.3,
              ease: "easeOut",
            }}
            style={{
              backgroundColor: 'transparent',
              mixBlendMode: 'normal',
            }}
          >
            {/* CSS Layer with backdrop effects - this actually affects content underneath */}
            <div className="absolute inset-0">
              {/* Pin-sized Core Flash */}
              <motion.div
                className="absolute w-2 h-2 bg-white rounded-full"
                style={{
                  left: '50%',
                  top: '-20px', // Moved higher - starts above screen edge
                  transform: 'translateX(-50%)',
                }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{
                  scale: [0, 1, 0],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 0.1,
                  times: [0, 0.5, 1],
                  ease: "easeOut",
                }}
              />

              {/* Expanding Ring */}
              {showShockwave && (
                <motion.div
                  className="absolute border-2 border-white rounded-full"
                  style={{
                    left: '50%',
                    top: '-10%', // Moved higher - starts above screen edge
                    transform: 'translateX(-50%) translateY(-50%)',
                  }}
                  initial={{
                    width: 8,
                    height: 4,
                    opacity: 0.5,
                    borderColor: 'rgba(255,255,255,1)',
                  }}
                  animate={{
                    width: [4, 200, 800, 1200],
                    height: [4, 200, 800, 1200],
                    opacity: [1, 0.8, 0.3, 0],
                    borderColor: [
                      'rgba(255,255,255,1)',
                      'rgba(255,255,255,0.8)',
                      'rgba(147,51,234,0.4)', // Purple tint
                      'rgba(147,51,234,0)',
                    ],
                  }}
                  transition={{
                    duration: duration / 1000,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                />
              )}

              {/* Ripple Distortion Effect */}
              {showShockwave && [0, 1, 2].map((index) => (
                <motion.div
                  key={`ripple-distort-${index}`}
                  className="absolute"
                  style={{
                    left: '50%',
                    top: '-20px', // Moved higher - starts above screen edge  
                    transform: 'translateX(-50%)',
                  }}
                  initial={{
                    width: 20,
                    height: 10,
                    opacity: 0,
                  }}
                  animate={{
                    width: [20, 600, 1000, 1400],
                    height: [10, 300, 500, 700],
                    opacity: [0, 0.8, 0.4, 0],
                  }}
                  transition={{
                    duration: duration / 1000,
                    delay: index * 0.1,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      clipPath: 'ellipse(50% 100% at 50% 0%)', // Creates half-circle from top
                      backdropFilter: `blur(${15 + index * 5}px) brightness(${1.2 + index * 0.1}) saturate(0.8)`,
                      background: `radial-gradient(ellipse at 50% 0%, 
                        rgba(255,255,255,0.2) 0%,
                        rgba(255,255,255,0.1) 30%,
                        rgba(147,51,234,0.05) 60%,
                        transparent 80%
                      )`,
                      mixBlendMode: 'overlay',
                      borderRadius: '0 0 50% 50%', // Rounded bottom for smooth half-circle
                    }}
                  />
                </motion.div>
              ))}

              {/* Debug Overlay */}
              {debugMode && (
                <motion.div
                  className="absolute top-4 left-4 bg-black/80 text-white p-3 rounded text-sm font-mono border border-yellow-400"
                  style={{ fontSize: '12px' }}
                >
                  <div className="text-yellow-400 font-bold mb-1">🔧 NameDrop Debug</div>
                  Progress: {Math.round(progress.get() * 100)}%<br/>
                  Shockwave Progress: {Math.round(shockwaveProgress.get() * 100)}%<br/>
                  Duration: {duration}ms<br/>
                  Shockwave: {showShockwave ? '🟢 Active' : '🔴 Inactive'}<br/>
                  <div className="text-green-400 mt-1">
                    🚀 WebGL Shader: Active
                  </div>
                  <div className="text-cyan-400 text-xs mt-1">
                    Check console for WebGL logs
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
