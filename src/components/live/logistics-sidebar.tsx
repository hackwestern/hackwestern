import { LogisticsLink } from './navlinks';

export const LogisticsSidebar = () => {
    return (
        <div className="hidden md:flex flex-col gap-4 bg-highlight h-fit w-fit rounded-2xl p-4 mx-12">
            <h1 className="font-jetbrains-mono text-heavy font-semibold">OVERVIEW</h1>
            <div className="flex flex-col gap-2">
                <LogisticsLink step="1" name="Packing List" />
                <LogisticsLink step="2" name="Communications" />
                <LogisticsLink step="3" name="Housekeeping" />
                <LogisticsLink step="4" name="Project Rules" />
                <LogisticsLink step="5" name="Contact Us" />
                <LogisticsLink step="6" name="FAQ" />
            </div>
        </div>
    )
}