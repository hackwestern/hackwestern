import PrimaryButton from "~/components/internals/primary-button";
import SecondaryButton from "~/components/internals/secondary-button";
import TertiaryButton from "~/components/internals/tertiary-button";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import TextField from "~/components/internals/text-field";
import { Textarea } from "~/components/ui/textarea";

const Right = ({ fill }: { fill?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="12"
      viewBox="0 0 14 12"
      fill="none"
      className="ml-2"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M7.17228 0.688789C7.32717 0.533946 7.53721 0.44696 7.75623 0.44696C7.97524 0.44696 8.18529 0.533946 8.34018 0.688789L13.2959 5.64452C13.4508 5.79941 13.5377 6.00946 13.5377 6.22847C13.5377 6.44748 13.4508 6.65753 13.2959 6.81242L8.34018 11.7682C8.1844 11.9186 7.97576 12.0019 7.7592 12C7.54264 11.9981 7.33548 11.9112 7.18234 11.7581C7.0292 11.605 6.94234 11.3978 6.94045 11.1812C6.93857 10.9647 7.02182 10.756 7.17228 10.6003L10.7181 7.05443H1.14859C0.92953 7.05443 0.719445 6.9674 0.564548 6.81251C0.409652 6.65761 0.322632 6.44753 0.322632 6.22847C0.322632 6.00941 0.409652 5.79933 0.564548 5.64443C0.719445 5.48954 0.92953 5.40251 1.14859 5.40251H10.7181L7.17228 1.85669C7.01744 1.7018 6.93045 1.49175 6.93045 1.27274C6.93045 1.05373 7.01744 0.843678 7.17228 0.688789Z"
        fill={fill ?? "white"}
      />
    </svg>
  );
};

function DesignSystem() {
  return (
    <div className="flex h-screen w-screen flex-col gap-4 bg-hw-radial-gradient p-12 font-jetbrains-mono">
      <h1 className="font-dico text-6xl">Design System HW12</h1>
      <div>BUTTON</div>
      <PrimaryButton isSkeleton>Primary Button</PrimaryButton>
      <PrimaryButton arrow>Primary Button</PrimaryButton>
      <SecondaryButton isSkeleton>Secondary Button</SecondaryButton>
      <SecondaryButton arrow isLoading>Secondary Button</SecondaryButton>
      <TertiaryButton isLoading>Tertiary Button</TertiaryButton>
      <TertiaryButton isLoading arrow disabled >Tertiary Button</TertiaryButton>
      <div>TEXT FIELD</div>
      <TextField isSkeleton>placeholder</TextField>
      <TextField submit>placeholder</TextField>
      <TextField secondary isSkeleton>placeholder</TextField>
      <TextField secondary submit>placeholder</TextField>
    </div>
  );
}

export default DesignSystem;
