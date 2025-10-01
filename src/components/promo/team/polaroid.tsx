import Image from "next/image";

interface PolaroidProps {
  src: string;
  alt: string;
  name: string;
  role: string;
  width?: number;
  height?: number;
  className?: string;
}

function Polaroid({ 
  src, 
  alt, 
  name,
  role,
  width = 221, 
  height = 221, 
  className = "" 
}: PolaroidProps) {
  return (
    <div className={`inline-block bg-white shadow-lg ${className}`} style={{ padding: '20px' }}>
      <div className="bg-gray-100" style={{ padding: '8px' }}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="block"
        />
      </div>
      <div className="mt-4 text-center">
        <div className="font-figtree text-center" style={{ fontWeight: 800, fontSize: '30px', lineHeight: '100%', letterSpacing: '0%', color: '#3C204C', maxWidth: '200px', wordWrap: 'break-word' }}>
          {name.length > 15 ? (() => {
            const words = name.split(' ');
            const firstLine = words[0];
            const remainingWords = words.slice(1).join(' ');
            return (
              <>
                {firstLine}
                <br />
                {remainingWords}
              </>
            );
          })() : (
            name
          )}
        </div>
        <div className="font-figtree text-sm mt-1" style={{ fontSize: '14px', lineHeight: '1.2', color: '#776780' }}>
          {role}
        </div>
      </div>
    </div>
  );
}

export default Polaroid;
