import { useState } from "react";
import PrimaryButton from "~/components/internals/primary-button";
import SecondaryButton from "~/components/internals/secondary-button";
import TertiaryButton from "~/components/internals/tertiary-button";
import TextField from "~/components/internals/text-field";
import * as tokens from "~/lib/tokens";
import { ColorSwatch } from "~/components/ui/color-swatch";
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
    <div className="font-jetbrains-mono flex min-h-screen w-screen flex-col gap-4 overflow-y-auto bg-hw-radial-gradient p-12 cursor-pixel-default">
      <h1 className="h1">Design System HW13</h1>

      <div className="h3">typography: </div>
      <div className="h1">heading 1</div>
      <div className="h2">heading 2</div>
      <div className="h3">heading 3</div>
      <div className="subtitle-lg">subtitle 1</div>
      <div className="subtitle-sm">subtitle 2</div>
      <div className="p1">large paragraph</div>
      <div className="p2">paragraph</div>
      <div className="p3">small paragraph</div>

      <div className="h3">colors: </div>
      <div
        className="p3 flex items-center gap-4"
      >
        <ColorSwatch value={tokens.colors.text.heavy} name="text / heavy" />
        <ColorSwatch value={tokens.colors.text.medium} name="text / medium" />
        <ColorSwatch value={tokens.colors.text.light} name="text / light" />
      </div>
      <div
        className="p3 flex items-center gap-4"
      >
        <ColorSwatch value={tokens.colors.bg.light} name="bg / light" />
        <ColorSwatch value={tokens.colors.bg.highlight} name="bg / highlight" />
      </div>
      <div
        className="p3 flex items-center gap-4"
      >
        <ColorSwatch name="white-0" value={tokens.colors.grays["white-0"]} />
        <ColorSwatch name="gray-1" value={tokens.colors.grays["gray-1"]} />
        <ColorSwatch name="gray-2" value={tokens.colors.grays["gray-2"]} />
        <ColorSwatch name="gray-3" value={tokens.colors.grays["gray-3"]} />
        <ColorSwatch name="gray-4" value={tokens.colors.grays["gray-4"]} />
        <ColorSwatch name="gray-5" value={tokens.colors.grays["gray-5"]} />
        <ColorSwatch name="gray-6" value={tokens.colors.grays["gray-6"]} />
        <ColorSwatch name="gray-7" value={tokens.colors.grays["gray-7"]} />
        <ColorSwatch name="gray-8" value={tokens.colors.grays["gray-8"]} />
        <ColorSwatch name="black-9" value={tokens.colors.grays["black-9"]} />
      </div>
      <div
        className="p3 flex items-center gap-4"
      >
        <ColorSwatch name="blue-1" value={tokens.colors.blues["blue-1"]} />
        <ColorSwatch name="blue-2" value={tokens.colors.blues["blue-2"]} />
        <ColorSwatch name="blue-3" value={tokens.colors.blues["blue-3"]} />
        <ColorSwatch name="blue-4" value={tokens.colors.blues["blue-4"]} />
        <ColorSwatch name="blue-5" value={tokens.colors.blues["blue-5"]} />
        <ColorSwatch name="blue-6" value={tokens.colors.blues["blue-6"]} />
        <ColorSwatch name="blue-7" value={tokens.colors.blues["blue-7"]} />
        <ColorSwatch name="blue-8" value={tokens.colors.blues["blue-8"]} />
        <ColorSwatch name="blue-9" value={tokens.colors.blues["blue-9"]} />
      </div>

      <h1 className="h2">Components</h1>

      <div className="mb-4 flex gap-4">
        <PrimaryButton onClick={handleClick} isLoading={isLoading} size="lg">
          Trigger Global Loading (5s)
        </PrimaryButton>
      </div>

      <div className="flex flex-col gap-8">
        <div>
          <div className="h3">Buttons:</div>
          <div className="p1">Primary Button: </div>
          <div className="w-fit grid grid-cols-2 items-center gap-4">
            <PrimaryButton isLoading={isLoading} onClick={handleClick} size="lg">
              Large
            </PrimaryButton>
            <PrimaryButton isLoading={isLoading} onClick={handleClick} size="sm">
              Small
            </PrimaryButton>

            <PrimaryButton isLoading={isLoading} onClick={handleClick} size="lg" direction="left">
              Left
            </PrimaryButton>
            <PrimaryButton isLoading={isLoading} onClick={handleClick} size="sm" direction="left">
              Left
            </PrimaryButton>

            <PrimaryButton isLoading={isLoading} onClick={handleClick} size="lg" direction="right">
              Right
            </PrimaryButton>
            <PrimaryButton isLoading={isLoading} onClick={handleClick} size="sm" direction="right">
              Right
            </PrimaryButton>

            
          </div>
          
        </div>

        <div>
          <div className="p1">Secondary Button: </div>
          <div className="w-fit grid grid-cols-2 items-center gap-4">
            <SecondaryButton isLoading={isLoading} onClick={handleClick} size="lg">
              Large
            </SecondaryButton>
            <SecondaryButton isLoading={isLoading} onClick={handleClick} size="sm">
              Small
            </SecondaryButton>

            <SecondaryButton isLoading={isLoading} onClick={handleClick} size="lg" direction="left">
              Left
            </SecondaryButton>
            <SecondaryButton isLoading={isLoading} onClick={handleClick} size="sm" direction="left">
              Left
            </SecondaryButton>

            <SecondaryButton isLoading={isLoading} onClick={handleClick} size="lg" direction="right">
              Right
            </SecondaryButton>
            <SecondaryButton isLoading={isLoading} onClick={handleClick} size="sm" direction="right">
              Right
            </SecondaryButton>

            
          </div>
        </div>
        
        <div>
          <div className="p1">Tertiary Button: </div>
          <div className="w-fit grid grid-cols-1 items-center gap-4">
            <TertiaryButton isLoading={isLoading} onClick={handleClick}>
              Button
            </TertiaryButton>

            <TertiaryButton isLoading={isLoading} onClick={handleClick} direction="left">
              Left
            </TertiaryButton>

            <TertiaryButton isLoading={isLoading} onClick={handleClick} direction="right">
              Right
            </TertiaryButton>
            
            {/* <TertiaryButton isSkeleton>Tertiary</TertiaryButton> */}
          </div>
        </div>
        
        <div>
          <div className="p1">Text field</div>
          <div className="flex flex-col gap-4">
            <TextField onSubmit={handleTextSubmit}>Normal Input</TextField>
            <TextField submit onSubmit={handleTextSubmit}>
              Input with Submit
            </TextField>

            {/* <div className="mt-4 flex flex-col gap-4">
              <div className="mb-2 font-bold">Skeletons</div>
              <TextField isSkeleton>Skeleton Input</TextField>
              <TextField submit isSkeleton>
                Skeleton Submit
              </TextField> 
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DesignSystem;
