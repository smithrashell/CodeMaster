import { useState } from "react";

/**
 * Custom hook for handling tag suggestions and input
 */
export function useTagSuggestions(availableTags) {
  const [inputValue, setInputValue] = useState("");
  const [suggestedTag, setSuggestedTag] = useState("");

  const handleInputChange = (event) => {
    const value = event.target.value;
    setInputValue(value);
    if (value) {
      const match = availableTags.find((tag) =>
        tag.toLowerCase().startsWith(value.toLowerCase())
      );
      setSuggestedTag(
        match
          ? match
              .replace(/^./, (char) => char.toUpperCase())
              .slice(value.length)
          : ""
      );
    } else {
      setSuggestedTag("");
    }
  };

  const handleKeyDown = (event, setTags, setIsInputVisible) => {
    if ((event.key === "Enter" || event.key === "Tab") && suggestedTag) {
      event.preventDefault();
      const completeTag = inputValue + suggestedTag;
      setTags((prevTags) => [...prevTags, completeTag]);
      setInputValue("");
      setSuggestedTag("");
      setIsInputVisible(false);
    } else if (event.key === "Escape") {
      setInputValue("");
      setSuggestedTag("");
      setIsInputVisible(false);
    }
  };

  const clearInput = () => {
    setInputValue("");
    setSuggestedTag("");
  };

  return {
    inputValue,
    suggestedTag,
    handleInputChange,
    handleKeyDown,
    clearInput,
  };
}