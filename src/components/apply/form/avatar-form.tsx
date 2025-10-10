import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Form } from "~/components/ui/form";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { personaSaveSchema } from "~/schemas/application";
import { useState } from "react";
/* eslint-disable @next/next/no-img-element */
import { categories, colors, avatarManifest } from "../../../constants/avatar";
import type { AvatarObject } from "../../../constants/avatar";
import { AvatarDisplay } from "../avatar-display";

type AvatarColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

// Helper to get accessory object from ID
export const getAccessoryFromId = (
  category: "face" | "left" | "right" | "hat",
  id: number | null,
): AvatarObject | null => {
  if (!id) return null;
  const item = avatarManifest[category].find((item) => item.id === id);
  if (!item) return null;
  return {
    id: item.id,
    name: item.alt,
    src: item.file,
    sizing: "sizing" in item ? item.sizing : undefined,
  };
};

export const getAccessoriesForCategory = (category: string) => {
  const noneOption: AvatarObject = {
    id: 0,
    name: "None",
    src: "",
  };

  switch (category) {
    case "face":
      return [
        noneOption,
        ...avatarManifest.face.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
            }) as AvatarObject,
        ),
      ];

    case "right":
      return [
        noneOption,
        ...avatarManifest.right.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
            }) as AvatarObject,
        ),
      ];

    case "left":
      return [
        noneOption,
        ...avatarManifest.left.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
            }) as AvatarObject,
        ),
      ];
    case "hat":
      return [
        noneOption,
        ...avatarManifest.hat.map(
          (AvatarEntry) =>
            ({
              id: AvatarEntry.id,
              name: AvatarEntry.alt,
              src: AvatarEntry.file,
              sizing: AvatarEntry?.sizing,
            }) as AvatarObject,
        ),
      ];

    default:
      return [];
  }
};

export function AvatarForm() {
  const utils = api.useUtils();
  const { data: defaultValues } = api.application.get.useQuery();
  const { mutate } = api.application.save.useMutation({
    onSuccess: () => {
      return utils.application.get.invalidate();
    },
  });

  const form = useForm<z.infer<typeof personaSaveSchema>>({
    resolver: zodResolver(personaSaveSchema),
  });

  const [selectedCategory, setSelectedCategory] = useState("face");

  // Watch form values for rendering
  const avatarColour = useWatch({
    control: form.control,
    name: "avatarColour",
  });
  const avatarFace = useWatch({
    control: form.control,
    name: "avatarFace",
  });
  const avatarLeftHand = useWatch({
    control: form.control,
    name: "avatarLeftHand",
  });
  const avatarRightHand = useWatch({
    control: form.control,
    name: "avatarRightHand",
  });
  const avatarHat = useWatch({
    control: form.control,
    name: "avatarHat",
  });

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof personaSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="overflow-y-hidden"
      >
        <div className="grid h-max gap-6 lg:grid-cols-2">
          {/* Left Side - Character Preview */}
          <div className="flex flex-col space-y-4">
            {/* Character Preview Area */}
            <div
              className="mx-auto my-auto flex h-[17rem] w-full flex-col justify-center overflow-y-hidden rounded-2xl p-4 py-10 2xl:h-[22rem] 3xl:h-[31rem]"
              style={{
                background: `linear-gradient(
                              135deg,
                              ${colors.find((c) => c.name === (avatarColour ?? "green"))?.bg ?? "#F1FDE0"} 30%,
                              ${colors.find((c) => c.name === (avatarColour ?? "green"))?.gradient ?? "#A7FB73"} 95%
                            )`,
              }}
            >
              <div className="mt-8 flex scale-75 items-center justify-center 2xl:scale-90 3xl:scale-110">
                <AvatarDisplay
                  avatarColour={avatarColour}
                  avatarFace={avatarFace}
                  avatarLeftHand={avatarLeftHand}
                  avatarRightHand={avatarRightHand}
                  avatarHat={avatarHat}
                />
              </div>
            </div>

            {/* Color Palette */}
            <div className="flex-shrink-0">
              <div className="flex justify-evenly gap-2">
                {colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => {
                      form.setValue("avatarColour", color.name as AvatarColor, {
                        shouldDirty: true,
                      });
                    }}
                    className={`h-8 w-8 flex-shrink-0 rounded-lg transition-all hover:scale-110 2xl:h-10 2xl:w-10 ${
                      avatarColour === color.name
                        ? "ring-2 ring-purple-200"
                        : ""
                    }`}
                    style={{
                      backgroundColor: color.value,
                      borderTop: "1px solid rgba(0, 0, 0, 0.08)",
                      borderLeft: "1px solid rgba(0, 0, 0, 0.08)",
                      borderRight: "1px solid rgba(0, 0, 0, 0.08)",
                      borderBottom: "3px solid rgba(0, 0, 0, 0.08)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Right Side - Accessory Selection */}
          <div className="flex min-h-0 flex-col">
            {/* Category Selection */}
            <div className="flex w-full flex-shrink-0 gap-2 pb-4">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex h-12 flex-1 items-center justify-center rounded-lg transition-all hover:scale-105 ${
                    selectedCategory === category.id
                      ? "bg-[#F5F2F6]"
                      : "bg-transparent hover:bg-gray-50"
                  }`}
                  title={category.id}
                >
                  <img
                    src={category.src}
                    alt={category.id}
                    className="h-8 w-8"
                  />
                </button>
              ))}
            </div>

            {/* Accessory Grid */}
            <div className="custom-scroll flex-1 overflow-y-auto overflow-x-hidden pr-2">
              <div className="z-0 grid w-full grid-cols-3 gap-3 md:h-0 md:grid-cols-2 lg:grid-cols-2 3xl:grid-cols-3">
                {getAccessoriesForCategory(selectedCategory).map(
                  (accessory) => {
                    // Get current value for this category
                    const currentValue =
                      selectedCategory === "face"
                        ? avatarFace
                        : selectedCategory === "left"
                          ? avatarLeftHand
                          : selectedCategory === "right"
                            ? avatarRightHand
                            : selectedCategory === "hat"
                              ? avatarHat
                              : null;

                    const isSelected =
                      currentValue === accessory.id ||
                      (accessory.id === 0 && !currentValue);

                    return (
                      <button
                        key={accessory.id}
                        type="button"
                        onClick={() => {
                          // update the corresponding form field immediately so auto-save sees it
                          const fieldName =
                            selectedCategory === "face"
                              ? "avatarFace"
                              : selectedCategory === "left"
                                ? "avatarLeftHand"
                                : selectedCategory === "right"
                                  ? "avatarRightHand"
                                  : selectedCategory === "hat"
                                    ? "avatarHat"
                                    : null;

                          if (fieldName) {
                            form.setValue(
                              fieldName,
                              accessory.id === 0 ? null : accessory.id,
                              { shouldDirty: true },
                            );
                          }
                        }}
                        className={`flex aspect-[7/5] w-full items-center justify-center rounded-lg border-2 transition-all hover:scale-[1.01] ${
                          isSelected
                            ? "bg-lilac"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                        style={
                          isSelected ? { borderColor: "var(--hw-purple)" } : {}
                        }
                      >
                        {accessory.src ? (
                          <div className="relative h-12 w-12 rounded-2xl lg:h-20 lg:w-20">
                            {/* Blurred white layer behind the thumbnail to feather edges */}
                            <div
                              aria-hidden
                              className="absolute inset-0 z-0 scale-105 transform rounded-full bg-white blur-md filter"
                            />
                            <img
                              src={accessory.src}
                              alt={accessory.name}
                              className="relative z-10 h-full w-full rounded-2xl object-contain p-1"
                            />
                          </div>
                        ) : (
                          <img
                            src={`/ellipse.png`}
                            alt="No selection"
                            className="h-8 w-8"
                          />
                        )}
                      </button>
                    );
                  },
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
