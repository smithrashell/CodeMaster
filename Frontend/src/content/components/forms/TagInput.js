import React, { useState, useRef } from "react";

const tags = [
  "Array",
  "String",
  "Hash Table",
  "Dynamic Programming",
  "Math",
  "Sorting",
  "Greedy",
  "Depth-First Search",
  "Database",
  "Binary Search",
  "Matrix",
  "Tree",
  "Breadth-First Search",
  "Bit Manipulation",
  "Two Pointers",
  "Prefix Sum",
  "Heap (Priority Queue)",
  "Binary Tree",
  "Simulation",
  "Stack",
  "Graph",
  "Counting",
  "Sliding Window",
  "Design",
  "Enumeration",
  "Backtracking",
  "Union Find",
  "Linked List",
  "Ordered Set",
  "Number Theory",
  "Monotonic Stack",
  "Segment Tree",
  "Trie",
  "Bitmask",
  "Combinatorics",
  "Queue",
  "Divide and Conquer",
  "Recursion",
  "Memoization",
  "Binary Indexed Tree",
  "Geometry",
  "Binary Search Tree",
  "Hash Function",
  "String Matching",
  "Topological Sort",
  "Shortest Path",
  "Rolling Hash",
  "Game Theory",
  "Interactive",
  "Data Stream",
  "Monotonic Queue",
  "Brainteaser",
  "Randomized",
  "Merge Sort",
  "Doubly-Linked List",
  "Counting Sort",
  "Iterator",
  "Concurrency",
  "Probability and Statistics",
  "Quickselect",
  "Suffix Array",
  "Bucket Sort",
  "Minimum Spanning Tree",
  "Line Sweep",
  "Shell",
  "Reservoir Sampling",
  "Strongly Connected Component",
  "Eulerian Circuit",
  "Radix Sort",
  "Rejection Sampling",
  "Biconnected Component",
];

export default function TagInput({ setTags }) {
  const [inputValue, setInputValue] = useState("");
  const [suggestedTag, setSuggestedTag] = useState("");
  const [isInputVisible, setIsInputVisible] = useState(false);
  const inputRef = useRef(null);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setInputValue(value);
    if (value) {
      const match = tags.find((tag) =>
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

  const handleKeyDown = (event) => {
    if ((event.key === "Enter" || event.key === "Tab") && suggestedTag) {
      event.preventDefault();
      const completeTag = inputValue + suggestedTag;
      setTags((prevTags) => [...prevTags, completeTag]);
      setInputValue("");
      setSuggestedTag("");
      setIsInputVisible(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => setIsInputVisible(false), 200);
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        flexWrap: "wrap",
      }}
    >
      {isInputVisible ? (
        <div
          style={{
            position: "relative",
            display: "inline-block",
            width: "160px",
            minHeight: "30px",
            marginBottom: "8px",
          }}
        >
          {/* Ghost text overlay for alignment */}
          <div
            style={{
              position: "absolute",
              width: "100%",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              overflow: "hidden",
              color: "transparent",
              fontFamily: "monospace", // Ensures perfect letter spacing
              fontSize: "14px",
              padding: "6px",
            }}
          >
            <span style={{ color: "inherit" }}>{inputValue}</span>
            <span style={{ color: "#aaa" }}>{suggestedTag}</span>
          </div>

          {/* Actual Input Field */}
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            style={{
              width: "100%",
              padding: "6px",
              minHeight: "30px",
              border: "none",
              background: "none",
              color: "inherit",
              outline: "none",
              fontSize: "14px",
              fontFamily: "monospace", // Matching font to the overlay text
              letterSpacing: "0.6px", // Fine-tuning spacing
              position: "relative",
            }}
          />
        </div>
      ) : (
        <p
          style={{ cursor: "pointer", color: "#ffffff", marginBottom: "8px" }}
          role="button"
          tabIndex={0}
          onClick={() => setIsInputVisible(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsInputVisible(true);
            }
          }}
        >
          + Add Tag
        </p>
      )}
    </div>
  );
}
