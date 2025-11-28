import { motion, useAnimation } from "framer-motion";
import { Drawer, DrawerContent, DrawerTrigger } from "../ui/drawer";
import { DialogTitle } from "@radix-ui/react-dialog";
import CanvasBackground from "../canvas-background";
import { MobileStampGroup } from "./animated-stamps";
import Image from "next/image";

export function MobileStickerDrawer() {
  const controls = useAnimation();

  async function handleStickerClick() {
    await controls.start({
      rotate: 180,
      transition: { duration: 0.2, ease: "easeInOut" },
    });
    await controls.start({
      rotate: 0,
      transition: { duration: 0.2, ease: "easeInOut" },
    });
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 overscroll-contain md:bottom-0 lg:hidden">
      <Drawer direction="bottom">
        <DrawerTrigger asChild>
          <motion.div
            onClick={handleStickerClick}
            animate={controls}
            whileTap={{ scale: 0.96 }}
            style={{ display: "inline-block", cursor: "pointer" }}
          >
            <Image
              src="/mobile-sticker.png"
              alt="Sticker Drawer"
              width={64}
              height={64}
            />
          </motion.div>
        </DrawerTrigger>
        <DrawerContent className="h-fit overflow-hidden overscroll-contain">
          <DialogTitle className="sr-only">Your Stickers</DialogTitle>
          <div className="z-[100] mx-auto h-2 w-[100px] rounded-full bg-muted" />
          <div className="absolute inset-0 overflow-hidden rounded-t-xl">
            <CanvasBackground />
          </div>
          <div className="relative h-full w-full overscroll-contain">
            <MobileStampGroup />
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
