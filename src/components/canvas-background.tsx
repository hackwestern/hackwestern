import React from "react";

const CanvasBackground = () => {
  return (
    <>
      <Gradient />
      <Dots />
      <Filter />
    </>
  );
};

function Gradient() {
  return (
    <div
      className="absolute inset-0 h-full w-full bg-hw-radial-gradient opacity-100"
      style={{
        backgroundImage: gradientBgImage,
      }}
    />
  );
}

function Dots() {
  return (
    <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#776780_1.5px,transparent_1px)] opacity-60 [background-size:20px_20px]" />
  );
}

function Filter() {
  return (
    <div className="contrast-60 pointer-events-none absolute inset-0 hidden h-full w-full bg-none filter md:inline md:bg-noise" />
  );
}

const gradientBgImage = `radial-gradient(ellipse 6000px 2000px at 3000px 1500px, var(--coral) 0%, var(--salmon) 41%, var(--lilac) 59%, var(--beige) 90%)`;

export default CanvasBackground;
