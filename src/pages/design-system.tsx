import { Button } from "~/components/ui/button";

function DesignSystem() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center bg-hw-radial-gradient">
      <h1>Design System HW12</h1>
      <Button variant="primary" className="px-8 py-4">Primary Button</Button>
    </div>
  );
}

export default DesignSystem;
