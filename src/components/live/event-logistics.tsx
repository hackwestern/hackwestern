import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import { PackingList, Item } from "~/constants/packingList";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button"
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { LogisticsLink } from './navlinks';

const EventLogistics = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const step = searchParams.get("step") ? parseInt(searchParams.get("step")!, 10) : 1;
    
    const [markdownId, setMarkdownId] = useState('');
    const [markdownContent, setMarkdownContent] = useState('');
    
    const [title, setTitle] = useState('');
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [loaded, setLoaded] = useState(false);

    // Handler for checkbox
    const handleToggle = (id: string, checked: boolean) => {
        setCheckedItems((prev) => ({
            ...prev,
            [id]: checked,
        }));
    };
    // Retrieve packing list checkbox data from local storage
    useEffect(() => {
        const saved = localStorage.getItem("packingListChecked");
        if (saved) {
            setCheckedItems(JSON.parse(saved));
        } else {
            const initialState: Record<string, boolean> = {};
            PackingList.forEach(item => initialState[item.id] = false);
            setCheckedItems(initialState);
        }
        localStorage.setItem("step", step.toString());
        setLoaded(true);
    }, []);

    // Save packing list checkbox to local storage upon changed to checkedItems
    useEffect(() => {
        if (!loaded) {
            return;
        }
        localStorage.setItem("packingListChecked", JSON.stringify(checkedItems));
    }, [checkedItems, loaded]);

    useEffect(() => {
        switch (step) {
            case 1:
                setTitle("PACKING LIST");
                setMarkdownId("packing-list")
                break;
            case 2:
                setTitle("COMMUNICATIONS");
                setMarkdownId("communications")
                break;
            case 3:
                setTitle("HOUSEKEEPING");
                setMarkdownId("housekeeping")
                break;
            case 4:
                setTitle("GENERAL & PROJECT RULES");
                setMarkdownId("general-project-rules")
                break;
            case 5:
                setTitle("CONTACT US");
                setMarkdownId("contact-us")
                break;
            case 6:
                setTitle("FREQUENTLY ASKED QUESTIONS");
                setMarkdownId("faq")
                break;
        }
        if (step !== 1) {
            fetch(`/live-logistics/${step}.md`) 
            .then((response) => response.text())
            .then((text) => setMarkdownContent(text))
            .catch((error) => console.error('Error fetching markdown:', error));
        }
    }, [step]);
    
    return (
        <div className="flex flex-row h-screen">
            <div className="overflow-auto flex-1">
                <div className="flex flex-row items-center justify-between mb-4 mr-2">
                    <div className="flex flex-col gap-2">
                        <p className="font-figtree text-light">Page {step} of 6</p>
                        <h1 className="font-jetbrains-mono text-medium text-xl">{title}</h1>
                    </div>
                    <div className="flex flex-row gap-2">
                        {step !== 1 &&
                            <Button 
                                variant="secondary"
                                className="px-5"
                                onClick={() => {
                                    const newStep = step - 1;
                                    router.push(`live/?tab=event-logistics&step=${newStep.toString()}`)
                                }}
                            >
                                <ArrowLeftIcon className="text-medium"/>
                            </Button>
                        }
                        {step !== 6 &&
                            <Button 
                                variant="secondary"
                                className="px-5"
                                onClick={() => {
                                    const newStep = step + 1;
                                    router.push(`live/?tab=event-logistics&step=${newStep.toString()}`)
                                }}
                            >
                                <ArrowRightIcon className="text-medium" />
                            </Button>
                        }
                    </div>
                </div>
                <hr className="border-[#ebdff7] mb-8"/>
                {(step === 1) ? (
                    PackingList.map((item: Item) => {
                        return (
                        <div key={item.id} className="flex flex-col items-left mt-4">
                            <div className="flex flex-row gap-4">
                                <Checkbox
                                    id={item.id}
                                    checked={checkedItems[item.id] ?? false}
                                    onCheckedChange={(checked: boolean) => handleToggle(item.id, checked)}
                                />
                                <h1 className="font-figtree text-lg text-heavy -mt-1">{item.heading}</h1>
                            </div>
                            <p className="font-figtree text-medium pl-7">{item.desc}</p>
                        </div>)
                    })
                ) :
                (
                    <ReactMarkdown>
                        {markdownContent}
                    </ReactMarkdown>)
                }
            </div>
            <LogisticsSidebar />
        </div>
    );
};

const LogisticsSidebar = () => {
    return (
        <div className="flex flex-col gap-4 bg-highlight h-fit w-fit rounded-2xl p-4 mx-12">
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
export default EventLogistics;
