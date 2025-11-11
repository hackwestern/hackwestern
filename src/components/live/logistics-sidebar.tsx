import { LogisticsLink } from "./navlinks";

export const LogisticsSidebar = () => {
  return (
    <div className="mx-12 hidden h-fit w-fit flex-col gap-4 rounded-2xl bg-highlight p-4 md:flex">
      <h1 className="font-jetbrains-mono font-semibold text-heavy">OVERVIEW</h1>
      <div className="flex flex-col gap-2">
        <LogisticsLink step="1" name="Packing List" />
        <LogisticsLink step="2" name="Communications" />
        <LogisticsLink step="3" name="Housekeeping" />
        <LogisticsLink step="4" name="Project Rules" />
        <LogisticsLink step="5" name="Contact Us" />
        <LogisticsLink step="6" name="FAQ" />
      </div>
    </div>
  );
};
