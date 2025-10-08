import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Form } from "~/components/ui/form";
import { api } from "~/utils/api";
import { useAutoSave } from "~/components/hooks/use-auto-save";
import { personaSaveSchema } from "~/schemas/application";
import { useState, useEffect } from "react";
/* eslint-disable @next/next/no-img-element */
import { categories, colors, avatarManifest } from "../../../constants/avatar";
import type { AvatarObject } from "../../../constants/avatar";

type AvatarColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink";

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
    defaultValues: {
      avatarColour: defaultValues?.avatarColour ?? "green",
      avatarFace: defaultValues?.avatarFace ?? null,
      avatarLeftHand: defaultValues?.avatarLeftHand ?? null,
      avatarRightHand: defaultValues?.avatarRightHand ?? null,
      avatarHat: defaultValues?.avatarHat ?? null,
    },
  });

  const [selectedColor, setSelectedColor] = useState<AvatarColor>(
    defaultValues?.avatarColour ?? "green",
  );
  const [selectedAccessories, setSelectedAccessories] = useState<{
    face: AvatarObject | null;
    right: AvatarObject | null;
    left: AvatarObject | null;
    hat: AvatarObject | null;
  }>({
    face: null,
    right: null,
    left: null,
    hat: null,
  });

  const [selectedCategory, setSelectedCategory] = useState("face");

  // Initialize state from defaultValues
  useEffect(() => {
    if (defaultValues) {
      if (defaultValues.avatarColour) {
        setSelectedColor(defaultValues.avatarColour);
      }
      if (defaultValues.avatarFace) {
        const faceItem = avatarManifest.face.find(
          (item) => item.id === defaultValues.avatarFace,
        );
        if (faceItem) {
          setSelectedAccessories((prev) => ({
            ...prev,
            face: {
              id: faceItem.id,
              name: faceItem.alt,
              src: faceItem.file,
            },
          }));
        }
      }
      if (defaultValues.avatarLeftHand) {
        const leftItem = avatarManifest.left.find(
          (item) => item.id === defaultValues.avatarLeftHand,
        );
        if (leftItem) {
          setSelectedAccessories((prev) => ({
            ...prev,
            left: {
              id: leftItem.id,
              name: leftItem.alt,
              src: leftItem.file,
            },
          }));
        }
      }
      if (defaultValues.avatarRightHand) {
        const rightItem = avatarManifest.right.find(
          (item) => item.id === defaultValues.avatarRightHand,
        );
        if (rightItem) {
          setSelectedAccessories((prev) => ({
            ...prev,
            right: {
              id: rightItem.id,
              name: rightItem.alt,
              src: rightItem.file,
            },
          }));
        }
      }
      if (defaultValues.avatarHat) {
        const hatItem = avatarManifest.hat.find(
          (item) => item.id === defaultValues.avatarHat,
        );
        if (hatItem) {
          setSelectedAccessories((prev) => ({
            ...prev,
            hat: {
              id: hatItem.id,
              name: hatItem.alt,
              src: hatItem.file,
              sizing: hatItem?.sizing,
            },
          }));
        }
      }
    }
  }, [defaultValues]);

  // Sync color changes to form
  useEffect(() => {
    form.setValue("avatarColour", selectedColor);
  }, [selectedColor, form]);

  // Sync accessory changes to form
  useEffect(() => {
    form.setValue("avatarFace", selectedAccessories.face?.id ?? null);
    form.setValue("avatarLeftHand", selectedAccessories.left?.id ?? null);
    form.setValue("avatarRightHand", selectedAccessories.right?.id ?? null);
    form.setValue("avatarHat", selectedAccessories.hat?.id ?? null);
  }, [selectedAccessories, form]);

  useAutoSave(form, onSubmit, defaultValues);

  function onSubmit(data: z.infer<typeof personaSaveSchema>) {
    mutate({
      ...defaultValues,
      ...data,
    });
  }

  const getAccessoriesForCategory = (category: string) => {
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

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid h-max gap-6 lg:grid-cols-2">
          {/* Left Side - Character Preview */}
          <div className="flex flex-col space-y-4">
            {/* Character Preview Area */}
            <div
              className="mx-auto my-auto flex h-72 w-full flex-col justify-center rounded-2xl p-4 py-10 2xl:h-[21rem] 3xl:h-[31rem]"
              style={{
                background: `linear-gradient(
                              135deg,
                              ${colors.find((c) => c.name === selectedColor)?.bg ?? "#F1FDE0"} 30%,
                              ${colors.find((c) => c.name === selectedColor)?.gradient ?? "#A7FB73"} 95%
                            )`,
              }}
            >
              <div className="mt-8 flex scale-75 items-center justify-center 2xl:scale-90 3xl:scale-110">
                <div className="relative h-64 w-64">
                  {/* Character Base */}

                  <img
                    src={`/avatar/body/${colors.find((c) => c.name === selectedColor)?.body ?? "002"}.webp`}
                    alt="Character body"
                    className="h-full w-full object-contain"
                  />

                  {/* Selected Accessory - Face */}
                  {selectedAccessories.face && (
                    <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2">
                      <img
                        src={selectedAccessories.face.src}
                        alt={selectedAccessories.face.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  {/* Selected Accessory - Hat */}
                  {selectedAccessories.hat && (
                    <div className="absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2">
                      <img
                        src={selectedAccessories.hat.src}
                        alt={selectedAccessories.hat.name}
                        className={`h-full w-full ${selectedAccessories.hat?.sizing} object-contain`}
                      />
                    </div>
                  )}

                  {/* Selected Accessory - Left Hand */}
                  {selectedAccessories.left && (
                    <div className="absolute -left-4 bottom-20 h-16 w-16">
                      <img
                        src={selectedAccessories.left.src}
                        alt={selectedAccessories.left.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}

                  {/* Selected Accessory - Right Hand */}
                  {selectedAccessories.right && (
                    <div className="absolute -right-4 bottom-20 h-16 w-16">
                      <img
                        src={selectedAccessories.right.src}
                        alt={selectedAccessories.right.name}
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Color Palette */}
            <div className="flex-shrink-0">
              <div className="flex justify-evenly gap-2">
                {colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.name as AvatarColor)}
                    className={`h-8 w-8 flex-shrink-0 rounded-lg transition-all hover:scale-110 2xl:h-10 2xl:w-10 ${
                      selectedColor === color.name
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
              <div className="grid h-0 w-full gap-3 md:grid-cols-2 lg:grid-cols-2 3xl:grid-cols-3">
                {getAccessoriesForCategory(selectedCategory).map(
                  (accessory) => (
                    <button
                      key={accessory.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccessories((prev) => ({
                          ...prev,
                          [selectedCategory]:
                            accessory.id === 0 ? null : accessory,
                        }));
                      }}
                      className={`flex aspect-[7/5] w-full items-center justify-center rounded-lg border-2 transition-all hover:scale-[1.01] ${
                        selectedAccessories[
                          selectedCategory as keyof typeof selectedAccessories
                        ]?.id === accessory.id ||
                        (accessory.id === 0 &&
                          !selectedAccessories[
                            selectedCategory as keyof typeof selectedAccessories
                          ])
                          ? "bg-lilac"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                      style={
                        selectedAccessories[
                          selectedCategory as keyof typeof selectedAccessories
                        ]?.id === accessory.id ||
                        (accessory.id === 0 &&
                          !selectedAccessories[
                            selectedCategory as keyof typeof selectedAccessories
                          ])
                          ? { borderColor: "var(--hw-purple)" }
                          : {}
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
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
