import { useState } from "react";
import PrimaryButton from "~/components/internals/primary-button";
import SecondaryButton from "~/components/internals/secondary-button";
import TertiaryButton from "~/components/internals/tertiary-button";
import TextField from "~/components/internals/text-field";

function DesignSystem() {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 5000);
  };

  const handleTextSubmit = async (val: string) => {
    await new Promise((resolve) => setTimeout(resolve, 5000));
  };

  return (
    <div className="flex min-h-screen w-screen flex-col gap-4 bg-hw-radial-gradient p-12 font-jetbrains-mono overflow-y-auto">
      <h1 className="font-dico text-6xl">Design System HW12</h1>
      
      <div className="mb-4 flex gap-4">
        <PrimaryButton onClick={handleClick} isLoading={isLoading}>
          Trigger Global Loading (5s)
        </PrimaryButton>
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <div className="mb-2 text-xl font-bold">PRIMARY BUTTON</div>
          <div className="flex flex-wrap items-center gap-4">
            <PrimaryButton isLoading={isLoading} onClick={handleClick}>Primary</PrimaryButton>
            <PrimaryButton isLoading={isLoading} onClick={handleClick} arrow>Primary Arrow</PrimaryButton>
            <PrimaryButton isSkeleton>Primary</PrimaryButton>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xl font-bold">SECONDARY BUTTON</div>
          <div className="flex flex-wrap items-center gap-4">
            <SecondaryButton isLoading={isLoading} onClick={handleClick}>Secondary</SecondaryButton>
            <SecondaryButton isLoading={isLoading} onClick={handleClick} arrow>Secondary Arrow</SecondaryButton>
            <SecondaryButton isSkeleton>Secondary</SecondaryButton>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xl font-bold">TERTIARY BUTTON</div>
          <div className="flex flex-wrap items-center gap-4">
            <TertiaryButton isLoading={isLoading} onClick={handleClick}>Tertiary</TertiaryButton>
            <TertiaryButton isLoading={isLoading} onClick={handleClick} arrow>Tertiary Arrow</TertiaryButton>
            <TertiaryButton isSkeleton>Tertiary</TertiaryButton>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xl font-bold">TEXT FIELD</div>
          <div className="flex flex-col gap-4">
            <TextField onSubmit={handleTextSubmit}>Normal Input</TextField>
            <TextField submit onSubmit={handleTextSubmit}>Input with Submit</TextField>
            
            <div className="flex w-max flex-col gap-4 rounded-lg bg-white p-4">
              <div className="mb-2 text-black font-bold">Secondary / Highlighted</div>
              <TextField secondary onSubmit={handleTextSubmit}>Secondary Input</TextField>
              <TextField submit secondary onSubmit={handleTextSubmit}>Secondary Submit</TextField>
            </div>

            <div className="flex gap-4 mt-4 flex-col">
              <div className="mb-2 font-bold">Skeletons</div>
              <TextField isSkeleton>Skeleton Input</TextField>
              <TextField submit isSkeleton>Skeleton Submit</TextField>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesignSystem;
