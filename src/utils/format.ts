export function formatTitle( tab: string ): string {
  const multipleWords = tab.includes("-");

  if (multipleWords) {
    const splitWords = tab.split("-");
    return splitWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }
  if (tab === "faq") {
    return tab.toUpperCase();
  }
  else {
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  }
}