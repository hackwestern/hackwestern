import ReactMarkdown from 'react-markdown';
import { useState, useEffect } from 'react';
import { PackingList, Item } from "~/constants/packingList";
import { Checkbox } from "~/components/ui/checkbox";
import { Button } from "~/components/ui/button"
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { LogisticsSidebar } from './logistics-sidebar';
import LogisticsTopbar from './logistics-topbar';

const EventLogistics = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const step = searchParams.get("step") ? parseInt(searchParams.get("step")!, 10) : 1;
    
    const [markdownContent, setMarkdownContent] = useState('');
    
    const [title, setTitle] = useState('');
    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
    const [loaded, setLoaded] = useState(false);
    const allTitles = ["Packing List", "Communications", "Housekeeping", "General & Project Rules", "Contact Us", "Frequently Asked Questions"]

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
        let id = "";
        switch (step) {
            case 1:
                setTitle("PACKING LIST");
                id = "packing-list";
                break;
            case 2:
                setTitle("COMMUNICATIONS");
                id = "communications";
                break;
            case 3:
                setTitle("HOUSEKEEPING");
                id = "housekeeping";
                break;
            case 4:
                setTitle("GENERAL & PROJECT RULES");
                id = "general-project-rules";
                break;
            case 5:
                setTitle("CONTACT US");
                id = "contact-us";
                break;
            case 6:
                setTitle("FREQUENTLY ASKED QUESTIONS");
                id = "faq";
                break;
        }
        if (step !== 1) {
            fetch(`/live-logistics/${id}.md`) 
            .then((response) => response.text())
            .then((text) => setMarkdownContent(text))
            .catch((error) => console.error('Error fetching markdown:', error));
        }
    }, [step]);
    
    return (
        <div className="flex flex-row h-full pr-2">
            <div className="overflow-auto flex-1">
                <div className="flex flex-row items-center justify-between mb-4 mr-2">
                    <div className="flex flex-col">
                        <div className="flex flex-row gap-2 items-center">
                            <LogisticsTopbar />
                            <p className="font-figtree text-light">Page {step} of 6</p>
                        </div>
                        <h1 className="font-jetbrains-mono text-medium text-2xl">{title}</h1>
                    </div>
                    <div className="flex flex-row gap-2 pl-4">
                        {step !== 1 &&
                            <Button 
                                variant="secondary"
                                className="px-2 md:px-5"
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
                                className="px-2 md:px-5"
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
                <hr className="h-2 border-[#ebdff7] mb-8"/>
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
                    <ReactMarkdown
                        components={{
                        h1: ({ node, ...props }) => (
                            <h1 className="text-2xl font-figtree font-medium text-heavy mt-8 mb-4" {...props} />
                        ),
                        p: ({ node, ...props }) => (
                            <p className="font-figtree text-medium leading-relaxed mb-4" {...props} />
                        ),
                        a: ({ node, ...props }) => (
                            <a
                            className="text-medium underline hover:text-light leading-relaxed transition-colors"
                            target="_blank"
                            rel="noopener noreferrer"
                            {...props}
                            />
                        ),
                        b: ({ node, ...props }) => (
                            <p className="font-bold font-figtree text-medium leading-relaxed mb-4" {...props} />
                        ),
                        i: ({ node, ...props }) => (
                            <p className="font-italic font-figtree text-medium leading-relaxed mb-4" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                            <ul className="list-disc pl-6 mb-4 space-y-1 font-figtree text-medium" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                            <ol className="list-decimal pl-6 mb-4 space-y-1 font-figtree text-medium" {...props} />
                        )
                        }}
                    >
                        {markdownContent}
                    </ReactMarkdown>
                )}
                <div className="flex flex-col items-end gap-4 md:flex-row md:justify-between mt-8">
                {step !== 1 &&
                    <Button
                        variant="tertiary"
                        className="text-base md:text-lg"
                        onClick={() => {
                            const newStep = step - 1;
                            router.push(`live/?tab=event-logistics&step=${newStep.toString()}`)
                        }}
                    >
                        <ArrowLeftIcon width={16}/>
                        Back: {allTitles[step - 2]}
                    </Button>
                }
                {step !== 6 &&
                (step === 1 ? (
                    <>
                        <div></div>
                        <Button
                        variant="tertiary"
                        className="text-lg"
                        onClick={() => {
                            const newStep = step + 1;
                            router.push(`live/?tab=event-logistics&step=${newStep.toString()}`)
                        }}
                        >
                            <ArrowRightIcon width={16}/>
                            Next: {allTitles[step]}
                        </Button>
                    </>) :(
                    <Button
                        variant="tertiary"
                        className="text-base md:text-lg"
                        onClick={() => {
                            const newStep = step + 1;
                            router.push(`live/?tab=event-logistics&step=${newStep.toString()}`)
                        }}
                    >
                        <ArrowRightIcon width={16}/>
                        Next: {allTitles[step]}
                    </Button>)
                )
                }
                </div>
            </div>
            <LogisticsSidebar />
        </div>
    );
};

export default EventLogistics;
