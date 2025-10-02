import Image from "next/image";
import { motion } from "framer-motion";
import { projectsPlaceHolder } from "~/constants/projectsPlaceholder";

const ROTATIONS = [-16, 3.214, 22];
const Y_OFFSETS = [85, 25, 100];
const Z_INDEXES = [0, 40, 50];
const X_INDEXES = [-5, 0, 10];

function HeaderCards() {
  const names = projectsPlaceHolder[0].map(
    ([image, description, url, name]) => ({
      image,
      description,
      url,
      name,
    }),
  );
  const folders = projectsPlaceHolder[1];

  const handleCardClick = (url: string) => {
    window.open(url, "_blank");
  };

  return (
    <div className="flex h-[404px] w-full shrink-0 justify-center">
      {names.map((name, i) => {
        const cleanName = name.name;
        const rotate = ROTATIONS[i % 3];
        const y = Y_OFFSETS[i % 3];
        const z = Z_INDEXES[i % 3];
        const x = X_INDEXES[i % 3];

        return (
          <motion.div
            key={name.image}
            initial={{ rotate, y, zIndex: z, x }}
            whileHover="hover"
            variants={{ hover: {} }}
            onClick={() => handleCardClick(name.url)}
            className="group pointer-events-auto absolute relative flex h-[292px] w-[369px] cursor-pointer flex-col items-center rounded-2xl border border-gray-200 bg-white p-[11px] shadow-xl transition-transform hover:scale-105"
            style={{ willChange: "transform" }}
          >
            <motion.div
              className="relative w-full overflow-hidden rounded"
              variants={{
                hover: {
                  height: 209,
                  transition: { duration: 0.25 },
                },
              }}
              animate={{ height: 230 }}
            >
              <Image
                src={`/projects/${folders[i]}/${name.image}`}
                alt={cleanName ?? "project image"}
                fill
                style={{ objectFit: "cover" }}
                className="bg-[lightgray]"
                priority
              />
            </motion.div>
            <motion.span
              className="mt-[10px] w-full text-center font-jetbrains-mono text-[16px] font-medium uppercase text-[color:var(--text-medium,#776780)]"
              variants={{
                hover: {
                  y: -5,
                  transition: { duration: 0.25 },
                },
              }}
              initial={{ y: 0 }}
            >
              {cleanName}
            </motion.span>
            <motion.p
              className="absolute bottom-0 left-2 right-2 text-center text-xs text-[color:var(--text-medium,#776780)]"
              variants={{
                hover: {
                  opacity: 1,
                  y: -10,
                  transition: { duration: 0.25 },
                },
              }}
              initial={{ opacity: 0, y: 0 }}
            >
              {name.description ?? "No description provided"}
            </motion.p>
          </motion.div>
        );
      })}
    </div>
  );
}

export default HeaderCards;
