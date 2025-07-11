// Backup of documentedit/page.tsx before load system rewrite
// Date: 2025-06-18

// ...existing code will be copied here...



"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BLOCK_TYPES = [
    { label: "Paragraph", value: "P" },
    { label: "Heading 1", value: "H1" },
    { label: "Heading 2", value: "H2" },
    { label: "Heading 3", value: "H3" },
    { label: "Blockquote", value: "BLOCKQUOTE" },
    { label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
    const editorRef = useRef<HTMLDivElement>(null);
    const gridOverlay = useRef<HTMLDivElement | null>(null);
    const gridColumns = useRef<HTMLDivElement[]>([]);
    const [blockType, setBlockType] = useState("P");
    const [isEmpty, setIsEmpty] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [showExtras, setShowExtras] = useState(false);
    const [extrasMenuPos, setExtrasMenuPos] = useState<{top:number,left:number,width:number}|null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const extrasBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
    let gridOverlayEl: HTMLDivElement | null = null;
    let gridColumnsEl: HTMLDivElement[] = [];

    useEffect(() => {
        setMounted(true);
        // Fade in editor after a short delay for smoothness
        const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
        // Fade out loader after editor is visible
        const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
        return () => {
            clearTimeout(fadeInTimeout);
            clearTimeout(loaderTimeout);
        };
    }, []);

    // --- GRID OVERLAY SHOW/HIDE HELPERS ---
    function showGridOverlay() {
        ensureGridOverlay();
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'flex';
            gridOverlay.current.style.pointerEvents = 'auto';
            gridOverlay.current.style.zIndex = '99999';
        }
    }
    function hideGridOverlay() {
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'none';
        }
    }

    // Helper to focus editor and run command
    // Update format state immediately after running a command
    const runCommand = (command: string, value?: any) => {
        if (editorRef.current) {
            editorRef.current.focus();
            setTimeout(() => {
                if (value !== undefined) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command);
                }
                detectBlockType();
                checkEmpty();
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                });
                // --- Use zero-width non-breaking space for bold/strike toggle ---
                if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
                        let node = sel.anchorNode;
                        if (node && node.nodeType === 3 && node.parentElement) {
                            let parent = node.parentElement;
                            const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
                            const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
                            if (isBold || isStrike) {
                                const offset = sel.anchorOffset;
                                const text = node.textContent || '';
                                // Split the text node at the caret
                                const before = text.slice(0, offset);
                                const after = text.slice(offset);
                                node.textContent = before;
                                // Insert a zero-width non-breaking space after the formatting node
                                const zwsp = document.createTextNode('\uFEFF');
                                if (parent.nextSibling) {
                                    parent.parentNode.insertBefore(zwsp, parent.nextSibling);
                                } else {
                                    parent.parentNode.appendChild(zwsp);
                                }
                                // Move caret to the zwsp
                                const range = document.createRange();
                                range.setStart(zwsp, 1);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Remove the zwsp on next input
                                const cleanup = () => {
                                    if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
                                    editorRef.current?.removeEventListener('input', cleanup);
                                };
                                editorRef.current.addEventListener('input', cleanup);
                                // Optionally, also clean up on paste
                                editorRef.current.addEventListener('paste', cleanup, { once: true });
                            }
                        }
                    }
                }
            }, 0);
        }
    };

    // Helper for link creation with selection restore
    const handleLink = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        // Save selection
        const savedRange = range.cloneRange();
        const url = prompt("Enter URL:");
        if (url) {
            editorRef.current.focus();
            // Restore selection
            selection.removeAllRanges();
            selection.addRange(savedRange);
            setTimeout(() => {
                document.execCommand("createLink", false, url);
            }, 0);
        }
    };

    // Detect block type on selection change
    const detectBlockType = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.anchorNode as HTMLElement | null;
        if (node && node.nodeType === 3) node = node.parentElement;
        while (node && node !== editorRef.current) {
            const tag = node.tagName;
            if (
                tag === "H1" ||
                tag === "H2" ||
                tag === "H3" ||
                tag === "BLOCKQUOTE" ||
                tag === "PRE" ||
                tag === "P"
            ) {
                setBlockType(tag);
                return;
            }
            node = node.parentElement;
        }
        setBlockType("P");
    };

    // Check if editor is empty
    const checkEmpty = () => {
        if (!editorRef.current) return;
        const text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
        setIsEmpty(text === "");
    };

    useEffect(() => {
        document.addEventListener("selectionchange", detectBlockType);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", checkEmpty);
            editorRef.current.addEventListener("blur", checkEmpty);
        }
        return () => {
            document.removeEventListener("selectionchange", detectBlockType);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", checkEmpty);
                editorRef.current.removeEventListener("blur", checkEmpty);
            }
        };
    }, []);

    // --- GRID OVERLAY DYNAMIC LINES ---
    function updateGridOverlayLines() {
        if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
        const editor = editorRef.current;
        const style = window.getComputedStyle(editor);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) lineHeight = 28; // fallback
        const editorHeight = editor.offsetHeight;
        const numRows = Math.floor(editorHeight / lineHeight);
        // Remove old horizontal lines
        [...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
        // Add horizontal lines
        for (let r = 1; r < numRows; r++) {
            const hline = document.createElement('div');
            hline.className = 'docedit-grid-hline';
            hline.style.position = 'absolute';
            hline.style.left = '0';
            hline.style.right = '0';
            hline.style.top = (r * lineHeight) + 'px';
            hline.style.height = '0';
            hline.style.borderTop = '1px dashed #818cf8';
            hline.style.pointerEvents = 'none';
            gridOverlay.current.appendChild(hline);
        }
        // Remove old rows from columns
        gridColumns.current.forEach((col) => {
            [...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
        });
    }

    function ensureGridOverlay() {
        if (!editorRef.current) return;
        if (!gridOverlay.current) {
            const overlay = document.createElement('div');
            overlay.className = 'docedit-grid-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'row';
            overlay.style.gap = '0';
            gridColumns.current = [];
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.style.flex = '1 1 0';
                col.style.height = '100%';
                col.style.background = 'none';
                col.className = 'docedit-grid-col';
                overlay.appendChild(col);
                gridColumns.current.push(col);
            }
            editorRef.current.appendChild(overlay);
            gridOverlay.current = overlay;
        }
        gridOverlay.current.style.display = 'flex';
        gridOverlay.current.style.pointerEvents = 'auto';
        gridOverlay.current.style.zIndex = '99999';
    }

    // Inject styles only on client
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const styleId = 'docedit-blockstyle';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
              .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
              .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
              .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
              .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
              .document-editor p { margin: 0.5em 0; }
              .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
              .document-editor ul { list-style-type: disc; }
              .document-editor ol { list-style-type: decimal; }
              .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
              .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
            `;
            document.head.appendChild(style);
        }
        // Toolbar styles
        const toolbarStyleId = 'docedit-toolbar-style';
        if (!document.getElementById(toolbarStyleId)) {
            const style = document.createElement('style');
            style.id = toolbarStyleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                .editor-toolbar {
                    background: #18181b;
                    box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
                    border-bottom: 2px solid #52525b;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                    min-height: 3.5rem;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                }
                .toolbar-btn {
                    padding: 0.35rem 0.7rem;
                    border-radius: 0.375rem;
                    background: #27272a;
                    color: #f3f4f6;
                    font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    margin-right: 0.15rem;
                    margin-bottom: 0.1rem;
                    min-width: 1.7rem;
                    min-height: 1.7rem;
                    line-height: 1.2;
                    font-size: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    cursor: pointer;
                }
                .toolbar-btn:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn:hover {
                    background: #3f3f46;
                    color: #a5b4fc;
                }
                .toolbar-btn:active {
                    background: #52525b;
                    color: #f3f4f6;
                }
                .toolbar-icon .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined', sans-serif;
                    font-size: 1.35rem;
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    vertical-align: middle;
                    margin: 0;
                }
                .toolbar-dropdown {
                    min-width: 8rem;
                    font-size: 1.05rem;
                    font-weight: 600;
                    background: #18181b;
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    padding: 0.3rem 0.7rem;
                    border-radius: 0.375rem;
                }
                .toolbar-dropdown:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn.menu-item {
                  border: 1.5px solid transparent;
                  transition: border 0.15s, background 0.15s, color 0.15s;
                }
                .toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
                  border: 1.5px solid #818cf8;
                  background: #3f3f46;
                  color: #a5b4fc;
                }
                .toolbar-btn.active {
                  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
                  color: #fff;
                  border: 2px solid #a5b4fc;
                  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
                  text-shadow: 0 0 4px #818cf8;
                }
            `;
            document.head.appendChild(style);
        }
        // Gradient outline styles
        const gradientStyleId = 'docedit-gradient-outline-style';
        if (!document.getElementById(gradientStyleId)) {
            const style = document.createElement('style');
            style.id = gradientStyleId;
            style.innerHTML = `
    .gradient-outline {
      position: relative;
      border-radius: 0.75rem;
      z-index: 1;
      padding: 3px;
      background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
      transition: box-shadow 0.2s;
    }
    .gradient-outline:focus-within, .gradient-outline:hover {
      box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
    }
    `;
            document.head.appendChild(style);
        }
        // Grid overlay styles
        const gridStyleId = 'docedit-grid-style';
        if (!document.getElementById(gridStyleId)) {
            const style = document.createElement('style');
            style.id = gridStyleId;
            style.innerHTML = `
                .docedit-grid-overlay {
                    pointer-events: auto;
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 99999;
                    display: flex;
                    flex-direction: row;
                    gap: 0;
                }
                .docedit-grid-col {
                    flex: 1 1 0;
                    height: 100%;
                    background: rgba(129,140,248,0.18); /* Indigo-400, semi-transparent */
                    border-left: 1px solid #6366f1;
                    border-right: 1px solid #6366f1;
                    position: relative;
                    transition: background 0.12s;
                }
                .docedit-grid-col:hover {
                    background: rgba(129,140,248,0.35);
                }
                .docedit-grid-row {
                    position: absolute;
                    left: 0; right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
                .docedit-grid-hline {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Save button gradient hover effect
        const saveBtnStyleId = 'docedit-save-btn-gradient-style';
        if (!document.getElementById(saveBtnStyleId)) {
            const style = document.createElement('style');
            style.id = saveBtnStyleId;
            style.innerHTML = `
                .save-btn-gradient {
                  background: #18181b;
                  border: 2px solid transparent;
                  box-shadow: none;
                  position: relative;
                  z-index: 1;
                  transition: background 0.5s cubic-bezier(.4,2,.6,1),
                              color 0.3s,
                              border 0.4s,
                              box-shadow 0.6s cubic-bezier(.4,2,.6,1);
                }
                .save-btn-gradient:hover, .save-btn-gradient:focus {
                  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
                  color: #fff;
                  border: 2px solid #a78bfa;
                  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        const li = node.nodeType === 3 ? node.parentElement : node;
        if (li && li.tagName === 'LI' && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                li.remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        console.log('handleIndent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0'); // 2 non-breaking spaces for a visual tab
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { console.log('No parent list'); return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi = li.previousElementSibling;
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            console.log('Indented li into sublist');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No previous sibling, cannot indent first item');
            return;
        }
    }

    function handleOutdent() {
        console.log('handleOutdent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) { console.log('No <li> found'); return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            // Outdent: move li after its parent list
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            console.log('Outdented li to parent list');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No grandparent list, cannot outdent');
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                        img.style.width = img.width + 'px';
                        img.style.height = img.height + 'px';
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';

                // Ensure image is added to wrapper before controls/handle
                wrapper.appendChild(img);

                // Remove wrapper border/background, only border the image
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';

                // Remove overlay controls, add context menu logic
                let contextMenu: HTMLDivElement | null = null;
                img.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    if (contextMenu) contextMenu.remove();
                    contextMenu = document.createElement('div');
                    contextMenu.className = 'docedit-img-contextmenu';
                    contextMenu.style.position = 'fixed';
                    contextMenu.style.left = e.clientX + 'px';
                    contextMenu.style.top = e.clientY + 'px';
                    contextMenu.style.background = '#18181b';
                    contextMenu.style.border = '2px solid #6366f1';
                    contextMenu.style.borderRadius = '0.5rem';
                    contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
                    contextMenu.style.zIndex = '2147483647'; // max z-index to always be on top
                    contextMenu.style.padding = '0.5em 0';
                    contextMenu.style.minWidth = '120px';
                    contextMenu.style.color = '#f3f4f6';
                    contextMenu.style.fontSize = '1rem';
                    contextMenu.style.display = 'flex';
                    contextMenu.style.flexDirection = 'column';

                    // Delete
                    const delBtn = document.createElement('button');
                    delBtn.textContent = 'Delete Image';
                    delBtn.style.background = 'none';
                    delBtn.style.border = 'none';
                    delBtn.style.color = '#f87171';
                    delBtn.style.padding = '0.5em 1em';
                    delBtn.style.textAlign = 'left';
                    delBtn.style.cursor = 'pointer';
                    delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
                    delBtn.onmouseleave = () => delBtn.style.background = 'none';
                    delBtn.onclick = ev => {
                        ev.stopPropagation();
                        wrapper.remove();
                        contextMenu?.remove();
                        if (editorRef.current) {
                            const event = new Event('input', { bubbles: true });
                            editorRef.current.dispatchEvent(event);
                        }
                    };
                    contextMenu.appendChild(delBtn);

                    // Float left
                    const leftBtn = document.createElement('button');
                    leftBtn.textContent = 'Float Left';
                    leftBtn.style.background = 'none';
                    leftBtn.style.border = 'none';
                    leftBtn.style.color = '#a5b4fc';
                    leftBtn.style.padding = '0.5em 1em';
                    leftBtn.style.textAlign = 'left';
                    leftBtn.style.cursor = 'pointer';
                    leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
                    leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
                    leftBtn.onclick = ev => {
                        ev.stopPropagation();
                        img.style.float = 'left';
                        img.style.display = 'inline';
                        img.style.margin = '0.5em 1em 0.5em 0';
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(leftBtn);

                    // Float right
                    const rightBtn = document.createElement('button');
                    rightBtn.textContent = 'Float Right';
                    rightBtn.style.background = 'none';
                    rightBtn.style.border = 'none';
                    rightBtn.style.color = '#a5b4fc';
                    rightBtn.style.padding = '0.5em 1em';
                    rightBtn.style.textAlign = 'left';
                    rightBtn.style.cursor = 'pointer';
                    rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
                    rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
                    rightBtn.onclick = ev => {
                        ev.stopPropagation();
                        img.style.float = 'right';
                        img.style.display = 'inline';
                        img.style.margin = '0.5em 0 0.5em 1em';
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(rightBtn);

                    // Inline
                    const inlineBtn = document.createElement('button');
                    inlineBtn.textContent = 'Inline';
                    inlineBtn.style.background = 'none';
                    inlineBtn.style.border = 'none';
                    inlineBtn.style.color = '#a5b4fc';
                    inlineBtn.style.padding = '0.5em 1em';
                    inlineBtn.style.textAlign = 'left';
                    inlineBtn.style.cursor = 'pointer';
                    inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
                    inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
                    inlineBtn.onclick = ev => {
                        ev.stopPropagation();
                        img.style.float = '';
                        img.style.display = 'inline-block';
                        img.style.margin = '0.5em 1em 0.5em 0';
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(inlineBtn);

                    // Snap to Grid
                    const gridBtn = document.createElement('button');
                    gridBtn.textContent = 'Snap to Grid';
                    gridBtn.style.background = 'none';
                    gridBtn.style.border = 'none';
                    gridBtn.style.color = '#a5b4fc';
                    gridBtn.style.padding = '0.5em 1em';
                    gridBtn.style.textAlign = 'left';
                    gridBtn.style.cursor = 'pointer';
                    gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
                    gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
                    gridBtn.onclick = ev => {
                        ev.stopPropagation();
                        contextMenu?.remove();
                        showGridOverlay();
                        // Wait for user to click a column
                        gridColumns.current.forEach((col, i) => {
                            col.style.cursor = 'pointer';
                            col.onclick = e => {
                                // Find the closest offset in the editor for this column
                                if (!editorRef.current) return;
                                const rect = editorRef.current.getBoundingClientRect();
                                const colWidth = rect.width / 12;
                                const x = rect.left + i * colWidth + colWidth / 2;
                                let range: Range | null = null;
                                if (document.caretRangeFromPoint) {
                                    range = document.caretRangeFromPoint(x, rect.top + 10); // 10px from top
                                } else if ((document as any).caretPositionFromPoint) {
                                    const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                    if (pos) {
                                        range = document.createRange();
                                        range.setStart(pos.offsetNode, pos.offset);
                                        range.collapse(true);
                                    }
                                }
                                if (range && editorRef.current.contains(range.startContainer)) {
                                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                    if (range.startContainer.nodeType === 3) {
                                        const textNode = range.startContainer as Text;
                                        const offset = range.startOffset;
                                        const before = textNode.textContent?.slice(0, offset) || '';
                                        const after = textNode.textContent?.slice(offset) || '';
                                        const parent = textNode.parentNode;
                                        if (parent) {
                                            if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                            parent.insertBefore(wrapper, textNode);
                                            if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                            if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                        }
                                    } else {
                                        range.insertNode(wrapper);
                                    }
                                    // Insert a zero-width space after if at end
                                    let zwsp: Text | null = null;
                                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                        zwsp = document.createTextNode('\u200B');
                                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                    }
                                    // Move caret after image (and zwsp)
                                    const sel = window.getSelection();
                                    if (sel) {
                                        const r = document.createRange();
                                        if (zwsp) {
                                            r.setStartAfter(zwsp);
                                        } else {
                                            r.setStartAfter(wrapper);
                                        }
                                        r.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(r);
                                        if (editorRef.current) editorRef.current.focus();
                                    }
                                }
                                hideGridOverlay();
                                // Remove click handlers after selection
                                gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                            };
                        });
                    };
                    contextMenu.appendChild(gridBtn);

                    // Untie (Free Move) / Retie (Inline/Float) toggle
                    const untieBtn = document.createElement('button');
                    untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
                    untieBtn.style.background = 'none';
                    untieBtn.style.border = 'none';
                    untieBtn.style.color = '#a5b4fc';
                    untieBtn.style.padding = '0.5em 1em';
                    untieBtn.style.textAlign = 'left';
                    untieBtn.style.cursor = 'pointer';
                    untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
                    untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
                    untieBtn.onclick = ev => {
                        ev.stopPropagation();
                        const isUntied = wrapper.getAttribute('data-untied') === 'true';
                        if (isUntied) {
                            // Retie: revert to inline
                            wrapper.setAttribute('data-untied', 'false');
                            wrapper.style.position = '';
                            wrapper.style.left = '';
                            wrapper.style.top = '';
                            wrapper.style.zIndex = '';
                            wrapper.style.pointerEvents = '';
                            img.style.display = 'block';
                        } else {
                            // Untie: enable free move
                            wrapper.setAttribute('data-untied', 'true');
                            wrapper.style.position = 'absolute';
                            wrapper.style.zIndex = '100';
                            wrapper.style.pointerEvents = 'auto';
                        }
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(untieBtn);

                    document.body.appendChild(contextMenu);

                    const removeMenu = () => {
                        contextMenu?.remove();
                        contextMenu = null;
                        document.removeEventListener('mousedown', onDocClick);
                    };
                    function onDocClick(ev: MouseEvent) {
                        if (contextMenu && !contextMenu.contains(ev.target as Node)) {
                            removeMenu();
                        }
                    }
                    setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
                });

                // Restore and improve image drag-and-drop
                let dragging = false, ghost: HTMLImageElement | null = null;
                img.addEventListener('mousedown', function(e: MouseEvent) {
                    // Only start drag if not clicking a handle
                    if (e.button !== 0 || e.target === cornerHandle) return;
                    e.preventDefault();
                    const isUntied = wrapper.getAttribute('data-untied') === 'true';
                    dragging = true;
                    img.style.opacity = '0.5';
                    ghost = img.cloneNode(true) as HTMLImageElement;
                    ghost.style.opacity = '0.7';
                    ghost.style.position = 'fixed';
                    ghost.style.pointerEvents = 'none';
                    ghost.style.zIndex = '9999';
                    // Center offset for Untie mode
                    let offsetX = 0, offsetY = 0;
                    if (isUntied) {
                        offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
                        offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
                        ghost.style.left = (e.clientX - offsetX) + 'px';
                        ghost.style.top = (e.clientY - offsetY) + 'px';
                    } else {
                        ghost.style.left = e.clientX + 'px';
                        ghost.style.top = e.clientY + 'px';
                    }
                    document.body.appendChild(ghost);
                    showGridOverlay();

                    function onMouseMove(ev: MouseEvent) {
                        if (!dragging || !ghost) return;
                        if (isUntied) {
                            ghost.style.left = (ev.clientX - img.width / 2) + 'px';
                            ghost.style.top = (ev.clientY - img.height / 2) + 'px';
                        } else {
                            ghost.style.left = ev.clientX + 'px';
                            ghost.style.top = ev.clientY + 'px';
                        }
                        // Highlight nearest grid column
                        if (editorRef.current && gridColumns.current.length) {
                            const rect = editorRef.current.getBoundingClientRect();
                            const x = ev.clientX - rect.left;
                            const colWidth = rect.width / 12;
                            const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                            gridColumns.current.forEach((col, i) => {
                                col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
                            });
                        }
                    }
                    function onMouseUp(ev: MouseEvent) {
                        dragging = false;
                        img.style.opacity = '1';
                        if (ghost) ghost.remove();
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        hideGridOverlay();
                        if (editorRef.current) {
                            const editorRect = editorRef.current.getBoundingClientRect();
                            const imgW = img.width;
                            const imgH = img.height;
                            let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
                            let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
                            // Clamp to editor bounds
                            x = Math.max(0, Math.min(x, editorRect.width - imgW));
                            y = Math.max(0, Math.min(y, editorRect.height - imgH));
                            if (isUntied) {
                                wrapper.setAttribute('data-untied', 'true');
                                wrapper.style.position = 'absolute';
                                wrapper.style.left = x + 'px';
                                wrapper.style.top = y + 'px';
                                wrapper.style.zIndex = '2147483645';
                                wrapper.style.pointerEvents = 'auto';
                                if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                editorRef.current.appendChild(wrapper);
                            } else {
                                // Find the closest offset in the editor for this column
                                const rect = editorRef.current.getBoundingClientRect();
                                const colWidth = rect.width / 12;
                                const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                                const col = gridColumns.current[colIdx];
                                if (col) {
                                    col.style.cursor = 'pointer';
                                    col.onclick = e => {
                                        // Find the closest offset in the editor for this column
                                        if (!editorRef.current) return;
                                        const rect = editorRef.current.getBoundingClientRect();
                                        const colWidth = rect.width / 12;
                                        const x = rect.left + colIdx * colWidth + colWidth / 2;
                                        let range: Range | null = null;
                                        if (document.caretRangeFromPoint) {
                                            range = document.caretRangeFromPoint(x, rect.top + 10); // 10px from top
                                        } else if ((document as any).caretPositionFromPoint) {
                                            const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                            if (pos) {
                                                range = document.createRange();
                                                range.setStart(pos.offsetNode, pos.offset);
                                                range.collapse(true);
                                            }
                                        }
                                        if (range && editorRef.current.contains(range.startContainer)) {
                                            if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                            if (range.startContainer.nodeType === 3) {
                                                const textNode = range.startContainer as Text;
                                                const offset = range.startOffset;
                                                const before = textNode.textContent?.slice(0, offset) || '';
                                                const after = textNode.textContent?.slice(offset) || '';
                                                const parent = textNode.parentNode;
                                                if (parent) {
                                                    if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                                    parent.insertBefore(wrapper, textNode);
                                                    if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                                    if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                                }
                                            } else {
                                                range.insertNode(wrapper);
                                            }
                                            // Insert a zero-width space after if at end
                                            let zwsp: Text | null = null;
                                            if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                                zwsp = document.createTextNode('\u200B');
                                                if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                            }
                                            // Move caret after image (and zwsp)
                                            const sel = window.getSelection();
                                            if (sel) {
                                                const r = document.createRange();
                                                if (zwsp) {
                                                    r.setStartAfter(zwsp);
                                                } else {
                                                    r.setStartAfter(wrapper);
                                                }
                                                r.collapse(true);
                                                sel.removeAllRanges();
                                                sel.addRange(r);
                                                if (editorRef.current) editorRef.current.focus();
                                            }
                                        }
                                        hideGridOverlay();
                                        // Remove click handlers after selection
                                        gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                                    };
                                }
                            }
                        }
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                // Insert at caret
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.collapse(false);
                    range.insertNode(wrapper);
                    // Insert a zero-width space after the wrapper if it's at the end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                    // Move caret after image (and zwsp)
                    if (wrapper.nextSibling) {
                        range.setStartAfter(wrapper.nextSibling);
                    } else {
                        range.setStartAfter(wrapper);
                    }
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // Update format state on selection and input
    useEffect(() => {
        function updateFormatState() {
            setFormatState({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strike: document.queryCommandState('strikeThrough'),
            });
        }
        document.addEventListener('selectionchange', updateFormatState);
        if (editorRef.current) {
            editorRef.current.addEventListener('input', updateFormatState);
        }
        return () => {
            document.removeEventListener('selectionchange', updateFormatState);
            if (editorRef.current) {
                editorRef.current.removeEventListener('input', updateFormatState);
            }
        };
    }, []);

    // Place this inside your component, before the return statement:
    function setupImageWrapper(wrapper: HTMLElement | null, img: HTMLImageElement) {
        // If already wrapped, use the wrapper; otherwise, create one
        if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
            wrapper = document.createElement('span');
            wrapper.className = 'docedit-img-wrapper';
            wrapper.style.display = 'inline-block';
            wrapper.style.position = 'relative';
            wrapper.style.width = 'fit-content';
            wrapper.style.height = 'fit-content';
            wrapper.style.padding = '0';
            wrapper.style.margin = '0';
            wrapper.style.background = 'none';
            img.parentNode?.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }
        // (You can add more setup here if needed, e.g., event listeners, handles, etc.)
    }

    // Update handleLoadDocument to call rehydrateEditor after inserting nodes:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          const doc = JSON.parse(text);
          if (doc && typeof doc.html === 'string') {
            if (editorRef.current) {
              // Clear editor
              editorRef.current.innerHTML = '';

          // Parse HTML into nodes
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = doc.html;

          // Insert nodes one by one, simulating user input
          for (const node of Array.from(tempDiv.childNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'IMG') {
              // Simulate image insertion using your logic
              const imgEl = node as HTMLImageElement;
              // Create a File object from base64 if possible
              if (imgEl.src.startsWith('data:')) {
                // Convert base64 to Blob and then to File
                const arr = imgEl.src.split(',');
                const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                const file = new File([u8arr], imgEl.alt || 'image.png', { type: mime });
                // Simulate file input event
                const dt = new DataTransfer();
                dt.items.add(file);
                if (imageInputRef.current) {
                  imageInputRef.current.files = dt.files;
                  // Call your handler
                  handleImageInsert({ target: imageInputRef.current } as any);
                }
              } else {
                // For remote images, just append
                editorRef.current.appendChild(imgEl.cloneNode(true));
              }
            } else if (node.nodeType === Node.TEXT_NODE) {
              // Wrap text nodes in <p>
              const p = document.createElement('p');
              p.textContent = node.textContent || '';
              editorRef.current.appendChild(p);
            } else {
              // For other elements, append as is
              editorRef.current.appendChild(node.cloneNode(true));
            }
          }
          // Rehydrate images after all nodes are inserted
          rehydrateEditor();
          toastSave('Document loaded!');
        }
      }
    } catch (err) {
      toast('Failed to load document.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// Update rehydrateEditor to use the new setupImageWrapper:
function rehydrateEditor() {
  if (!editorRef.current) return;
  editorRef.current.querySelectorAll('img').forEach(img => {
    setupImageWrapper(img.parentElement, img);
  });
}

// Render the editor and toolbar
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
                    {/* Gradient outline wrapper */}
                    <div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
                        <div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
                            {/* Beautified Toolbar with site-wide look */}
                            <div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
                                <div className="flex gap-1 items-center">
                                    <button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
                                        <span className="material-symbols-outlined">undo</span>
                                    </button>
                                    <button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
                                        <span className="material-symbols-outlined">redo</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <select
                                        className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
                                        value={blockType}
                                        onChange={e => {
                                            setBlockType(e.target.value);
                                            runCommand('formatBlock', e.target.value);
                                        }}
                                        title="Block type"
                                    >
                                        {BLOCK_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
                                        <span className="material-symbols-outlined">format_list_bulleted</span>
                                    </button>
                                    <button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </button>
                                    <button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
                                        <span className="material-symbols-outlined">format_indent_decrease</span>
                                    </button>
                                    <button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
                                        <span className="material-symbols-outlined">format_indent_increase</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
                                        <span className="material-symbols-outlined">link</span>
                                    </button>
                                    <button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
                                        <span className="material-symbols-outlined">link_off</span>
                                    </button>
                                </div>
                                {/* Save & Extras group at far right */}
                                <div className="flex gap-2 ml-auto items-center">
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Load
                                    </button>
                                    <input
                                        type="file"
                                        accept=".havdoc"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleLoadDocument}
                                    />
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={saveDocument}
                                    >
                                        Save
                                    </button>
                                    <div className="relative">
                                        <button
                                            ref={extrasBtnRef}
                                            type="button"
                                            className="toolbar-btn toolbar-icon"
                                            title="Extras"
                                            onClick={() => setShowExtras(e => !e)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                        {showExtras && createPortal(
                                            (() => {
                                                if (!extrasBtnRef.current) return null;
                                                const rect = extrasBtnRef.current.getBoundingClientRect();
                                                return (
                                                    <div
                                                        className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999]"
                                                        style={{
                                                            top: rect.bottom + 4 + window.scrollY,
                                                            left: rect.right - 224 + window.scrollX, // 224px = menu width
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <b>B</b>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <i>I</i>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <u>U</u>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <s>S</s>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item"
                                                            onClick={() => {
                                                                setShowExtras(false);
                                                                setTimeout(() => imageInputRef.current?.click(), 100);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined align-middle mr-2">image</span>
                                                            Insert Image
                                                        </button>
                                                    </div>
                                                );
                                            })(),
                                            document.body
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleImageInsert}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Editor area */}
                            <div
                                ref={editorRef}
                                className="relative flex-1 min-h-[600px] flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
                                contentEditable
                                suppressContentEditableWarning
                                spellCheck={true}
                                aria-label="Document editor"
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                onInput={checkEmpty}
                                style={{flex:1, minHeight:'0'}}
                                onKeyDown={e => {
                                    // Tab/Shift+Tab for indent/outdent
                                    if (e.key === 'Tab') {
                                        e.preventDefault();
                                        if (e.shiftKey) {
                                            handleOutdent();
                                        } else {
                                            handleIndent();
                                        }
                                    }
                                    handleEditorKeyDown(e);
                                }}
                            >
                                {/* Overlay placeholder, not in content flow */}
                                {isEmpty && !isFocused && (
                                    <span className="editor-placeholder">Start your document...</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Loader overlay and fade-in logic remain unchanged */}
            {showLoader && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
                    <span className="loader" aria-label="Loading" />
                </div>
            )}
        </div>
    );

    // Move this to before the return statement so it's in scope for JSX
    function toast(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.innerHTML = `
          <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
          <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
        `;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'rgba(49,46,129,0.98)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 3500);
      }
    }

    // Add a separate toastSave function for the Save button
    function toastSave(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 2000);
      }
    }

    // Add this function inside your component:
    function saveDocument() {
      if (!editorRef.current) return;
      // Clone the editor content to avoid modifying the live DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      // Gather untied images (images not inside a block or grid, or with a special class)
      const images = Array.from(clone.querySelectorAll('img')).map(img => {
        // Get base64 data if possible
        let src = img.src;
        // If the image is a data URL, keep as is; otherwise, try to fetch and convert
        if (!src.startsWith('data:')) {
          // For remote images, skip or fetch as base64 (optional, not implemented here)
        }
        // Collect placement and style info
        return {
          src,
          style: img.getAttribute('style'),
          class: img.getAttribute('class'),
          width: img.width,
          height: img.height,
          alt: img.alt,
          id: img.id,
          parent: img.parentElement?.className || '',
          // Add more attributes as needed
        };
      });
      // Save the HTML (with image srcs as data URLs)
      const html = clone.innerHTML;
      // Bundle into a .havdoc JSON structure
      const doc = {
        type: 'havdoc',
        version: 1,
        html,
        images,
        savedAt: new Date().toISOString()
      };
      // Add magic header
      const magicHeader = 'HAVDOCv1\n';
      const blob = new Blob([
        magicHeader + JSON.stringify(doc, null, 2)
      ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${Date.now()}.havdoc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toastSave('Document saved!');
    }

    // Add this handler at the top of your component:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          const doc = JSON.parse(text);
          if (doc && typeof doc.html === 'string') {
            if (editorRef.current) {
              // Clear editor
              editorRef.current.innerHTML = '';

          // Parse HTML into nodes
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = doc.html;

          // Insert nodes one by one, simulating user input
          for (const node of Array.from(tempDiv.childNodes)) {
            if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'IMG') {
              // Simulate image insertion using your logic
              const imgEl = node as HTMLImageElement;
              // Create a File object from base64 if possible
              if (imgEl.src.startsWith('data:')) {
                // Convert base64 to Blob and then to File
                const arr = imgEl.src.split(',');
                const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                const file = new File([u8arr], imgEl.alt || 'image.png', { type: mime });
                // Simulate file input event
                const dt = new DataTransfer();
                dt.items.add(file);
                if (imageInputRef.current) {
                  imageInputRef.current.files = dt.files;
                  // Call your handler
                  handleImageInsert({ target: imageInputRef.current } as any);
                }
              } else {
                // For remote images, just append
                editorRef.current.appendChild(imgEl.cloneNode(true));
              }
            } else if (node.nodeType === Node.TEXT_NODE) {
              // Wrap text nodes in <p>
              const p = document.createElement('p');
              p.textContent = node.textContent || '';
              editorRef.current.appendChild(p);
            } else {
              // For other elements, append as is
              editorRef.current.appendChild(node.cloneNode(true));
            }
          }
          // Rehydrate images after all nodes are inserted
          rehydrateEditor();
          toastSave('Document loaded!');
        }
      }
    } catch (err) {
      toast('Failed to load document.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function rehydrateEditor() {
  if (!editorRef.current) return;
  // For each image, re-apply wrappers and event listeners
  editorRef.current.querySelectorAll('img').forEach(img => {
    // Remove any existing wrapper if present
    if (img.parentElement && img.parentElement.classList.contains('image-wrapper')) {
      // Already wrapped, maybe skip or re-setup
      setupImageWrapper(img.parentElement, img);
    } else {
      // Wrap and setup
      setupImageWrapper(null, img);
    }
  });
  // Optionally, wrap text nodes in <p> or your block element if needed
}
}









//NEW FILES THAT WORKS

"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BLOCK_TYPES = [
    { label: "Paragraph", value: "P" },
    { label: "Heading 1", value: "H1" },
    { label: "Heading 2", value: "H2" },
    { label: "Heading 3", value: "H3" },
    { label: "Blockquote", value: "BLOCKQUOTE" },
    { label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
    const editorRef = useRef<HTMLDivElement>(null);
    const gridOverlay = useRef<HTMLDivElement | null>(null);
    const gridColumns = useRef<HTMLDivElement[]>([]);
    const [blockType, setBlockType] = useState("P");
    const [isEmpty, setIsEmpty] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [showExtras, setShowExtras] = useState(false);
    const [extrasMenuPos, setExtrasMenuPos] = useState<{top:number,left:number,width:number}|null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const extrasBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
    const [editorHtml, setEditorHtml] = useState<string>(""); // keep for save/load, not for rendering
    let gridOverlayEl: HTMLDivElement | null = null;
    let gridColumnsEl: HTMLDivElement[] = [];

    useEffect(() => {
        setMounted(true);
        // Fade in editor after a short delay for smoothness
        const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
        // Fade out loader after editor is visible
        const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
        return () => {
            clearTimeout(fadeInTimeout);
            clearTimeout(loaderTimeout);
        };
    }, []);

    // --- GRID OVERLAY SHOW/HIDE HELPERS ---
    function showGridOverlay() {
        ensureGridOverlay();
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'flex';
            gridOverlay.current.style.pointerEvents = 'auto';
            gridOverlay.current.style.zIndex = '99999';
        }
    }
    function hideGridOverlay() {
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'none';
        }
    }

    // Helper to focus editor and run command
    // Update format state immediately after running a command
    const runCommand = (command: string, value?: any) => {
        if (editorRef.current) {
            editorRef.current.focus();
            setTimeout(() => {
                if (value !== undefined) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command);
                }
                detectBlockType();
                checkEmpty();
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                });
                // --- Use zero-width non-breaking space for bold/strike toggle ---
                if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
                        let node = sel.anchorNode;
                        if (node && node.nodeType === 3 && node.parentElement) {
                            let parent = node.parentElement;
                            const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
                            const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
                            if (isBold || isStrike) {
                                const offset = sel.anchorOffset;
                                const text = node.textContent || '';
                                // Split the text node at the caret
                                const before = text.slice(0, offset);
                                const after = text.slice(offset);
                                node.textContent = before;
                                // Insert a zero-width non-breaking space after the formatting node
                                const zwsp = document.createTextNode('\uFEFF');
                                if (parent.nextSibling) {
                                    parent.parentNode.insertBefore(zwsp, parent.nextSibling);
                                } else {
                                    parent.parentNode.appendChild(zwsp);
                                }
                                // Move caret to the zwsp
                                const range = document.createRange();
                                range.setStart(zwsp, 1);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Remove the zwsp on next input
                                const cleanup = () => {
                                    if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
                                    editorRef.current?.removeEventListener('input', cleanup);
                                };
                                editorRef.current.addEventListener('input', cleanup);
                                // Optionally, also clean up on paste
                                editorRef.current.addEventListener('paste', cleanup, { once: true });
                            }
                        }
                    }
                }
            }, 0);
        }
    };

    // Helper for link creation with selection restore
    const handleLink = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        // Save selection
        const savedRange = range.cloneRange();
        const url = prompt("Enter URL:");
        if (url) {
            editorRef.current.focus();
            // Restore selection
            selection.removeAllRanges();
            selection.addRange(savedRange);
            setTimeout(() => {
                document.execCommand("createLink", false, url);
            }, 0);
        }
    };

    // Detect block type on selection change
    const detectBlockType = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.anchorNode as HTMLElement | null;
        if (node && node.nodeType === 3) node = node.parentElement;
        while (node && node !== editorRef.current) {
            const tag = node.tagName;
            if (
                tag === "H1" ||
                tag === "H2" ||
                tag === "H3" ||
                tag === "BLOCKQUOTE" ||
                tag === "PRE" ||
                tag === "P"
            ) {
                setBlockType(tag);
                return;
            }
            node = node.parentElement;
        }
        setBlockType("P");
    };

    // Check if editor is empty
    const checkEmpty = () => {
        let text = "";
        if (editorRef.current) {
            text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
        } else if (editorHtml) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = editorHtml;
            text = tempDiv.innerText.replace(/\n|\r/g, "").trim();
        }
        setIsEmpty(text === "");
    };

    useEffect(() => {
        document.addEventListener("selectionchange", detectBlockType);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", checkEmpty);
            editorRef.current.addEventListener("blur", checkEmpty);
        }
        return () => {
            document.removeEventListener("selectionchange", detectBlockType);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", checkEmpty);
                editorRef.current.removeEventListener("blur", checkEmpty);
            }
        };
    }, []);

    // --- GRID OVERLAY DYNAMIC LINES ---
    function updateGridOverlayLines() {
        if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
        const editor = editorRef.current;
        const style = window.getComputedStyle(editor);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) lineHeight = 28; // fallback
        const editorHeight = editor.offsetHeight;
        const numRows = Math.floor(editorHeight / lineHeight);
        // Remove old horizontal lines
        [...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
        // Add horizontal lines
        for (let r = 1; r < numRows; r++) {
            const hline = document.createElement('div');
            hline.className = 'docedit-grid-hline';
            hline.style.position = 'absolute';
            hline.style.left = '0';
            hline.style.right = '0';
            hline.style.top = (r * lineHeight) + 'px';
            hline.style.height = '0';
            hline.style.borderTop = '1px dashed #818cf8';
            hline.style.pointerEvents = 'none';
            gridOverlay.current.appendChild(hline);
        }
        // Remove old rows from columns
        gridColumns.current.forEach((col) => {
            [...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
        });
    }

    function ensureGridOverlay() {
        if (!editorRef.current) return;
        if (!gridOverlay.current) {
            const overlay = document.createElement('div');
            overlay.className = 'docedit-grid-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'row';
            overlay.style.gap = '0';
            gridColumns.current = [];
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.style.flex = '1 1 0';
                col.style.height = '100%';
                col.style.background = 'none';
                col.className = 'docedit-grid-col';
                overlay.appendChild(col);
                gridColumns.current.push(col);
            }
            editorRef.current.appendChild(overlay);
            gridOverlay.current = overlay;
        }
        gridOverlay.current.style.display = 'flex';
        gridOverlay.current.style.pointerEvents = 'auto';
        gridOverlay.current.style.zIndex = '99999';
    }

    // Inject styles only on client
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const styleId = 'docedit-blockstyle';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
              .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
              .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
              .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
              .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
              .document-editor p { margin: 0.5em 0; }
              .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
              .document-editor ul { list-style-type: disc; }
              .document-editor ol { list-style-type: decimal; }
              .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
              .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
            `;
            document.head.appendChild(style);
        }
        // Toolbar styles
        const toolbarStyleId = 'docedit-toolbar-style';
        if (!document.getElementById(toolbarStyleId)) {
            const style = document.createElement('style');
            style.id = toolbarStyleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                .editor-toolbar {
                    background: #18181b;
                    box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
                    border-bottom: 2px solid #52525b;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                    min-height: 3.5rem;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                }
                .toolbar-btn {
                    padding: 0.35rem 0.7rem;
                    border-radius: 0.375rem;
                    background: #27272a;
                    color: #f3f4f6;
                    font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    margin-right: 0.15rem;
                    margin-bottom: 0.1rem;
                    min-width: 1.7rem;
                    min-height: 1.7rem;
                    line-height: 1.2;
                    font-size: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    cursor: pointer;
                }
                .toolbar-btn:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn:hover {
                    background: #3f3f46;
                    color: #a5b4fc;
                }
                .toolbar-btn:active {
                    background: #52525b;
                    color: #f3f4f6;
                }
                .toolbar-icon .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined', sans-serif;
                    font-size: 1.35rem;
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    vertical-align: middle;
                    margin: 0;
                }
                .toolbar-dropdown {
                    min-width: 8rem;
                    font-size: 1.05rem;
                    font-weight: 600;
                    background: #18181b;
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    padding: 0.3rem 0.7rem;
                    border-radius: 0.375rem;
                }
                .toolbar-dropdown:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn.menu-item {
                  border: 1.5px solid transparent;
                  transition: border 0.15s, background 0.15s, color 0.15s;
                }
                .toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
                  border: 1.5px solid #818cf8;
                  background: #3f3f46;
                  color: #a5b4fc;
                }
                .toolbar-btn.active {
                  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
                  color: #fff;
                  border: 2px solid #a5b4fc;
                  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
                  text-shadow: 0 0 4px #818cf8;
                }
            `;
            document.head.appendChild(style);
        }
        // Gradient outline styles
        const gradientStyleId = 'docedit-gradient-outline-style';
        if (!document.getElementById(gradientStyleId)) {
            const style = document.createElement('style');
            style.id = gradientStyleId;
            style.innerHTML = `
    .gradient-outline {
      position: relative;
      border-radius: 0.75rem;
      z-index: 1;
      padding: 3px;
      background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
      transition: box-shadow 0.2s;
    }
    .gradient-outline:focus-within, .gradient-outline:hover {
      box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
    }
    `;
            document.head.appendChild(style);
        }
        // Grid overlay styles
        const gridStyleId = 'docedit-grid-style';
        if (!document.getElementById(gridStyleId)) {
            const style = document.createElement('style');
            style.id = gridStyleId;
            style.innerHTML = `
                .docedit-grid-overlay {
                    pointer-events: auto;
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 99999;
                    display: flex;
                    flex-direction: row;
                    gap: 0;
                }
                .docedit-grid-col {
                    flex: 1 1 0;
                    height: 100%;
                    background: rgba(129,140,248,0.18); /* Indigo-400, semi-transparent */
                    border-left: 1px solid #6366f1;
                    border-right: 1px solid #6366f1;
                    position: relative;
                    transition: background 0.12s;
                }
                .docedit-grid-col:hover {
                    background: rgba(129,140,248,0.35);
                }
                .docedit-grid-row {
                    position: absolute;
                    left: 0; right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
                .docedit-grid-hline {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Save button gradient hover effect
        const saveBtnStyleId = 'docedit-save-btn-gradient-style';
        if (!document.getElementById(saveBtnStyleId)) {
            const style = document.createElement('style');
            style.id = saveBtnStyleId;
            style.innerHTML = `
                .save-btn-gradient {
                  background: #18181b;
                  border: 2px solid transparent;
                  box-shadow: none;
                  position: relative;
                  z-index: 1;
                  transition: background 0.5s cubic-bezier(.4,2,.6,1),
                              color 0.3s,
                              border 0.4s,
                              box-shadow 0.6s cubic-bezier(.4,2,.6,1);
                }
                .save-btn-gradient:hover, .save-btn-gradient:focus {
                  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
                  color: #fff;
                  border: 2px solid #a78bfa;
                  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        const li = node.nodeType === 3 ? node.parentElement : node;
        if (li && li.tagName === 'LI' && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                li.remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        console.log('handleIndent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0'); // 2 non-breaking spaces for a visual tab
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { console.log('No parent list'); return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi = li.previousElementSibling;
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            console.log('Indented li into sublist');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No previous sibling, cannot indent first item');
            return;
        }
    }

    function handleOutdent() {
        console.log('handleOutdent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) { console.log('No <li> found'); return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            // Outdent: move li after its parent list
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            console.log('Outdented li to parent list');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No grandparent list, cannot outdent');
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                        img.style.width = img.width + 'px';
                        img.style.height = img.height + 'px';
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';

                // Ensure image is added to wrapper before controls/handle
                wrapper.appendChild(img);

                // Remove wrapper border/background, only border the image
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';

                // Remove overlay controls, add context menu logic
                let contextMenu: HTMLDivElement | null = null;
                img.addEventListener('contextmenu', function(e) {
                    e.preventDefault();
                    if (contextMenu) contextMenu.remove();
                    contextMenu = document.createElement('div');
                    contextMenu.className = 'docedit-img-contextmenu';
                    contextMenu.style.position = 'fixed';
                    contextMenu.style.left = e.clientX + 'px';
                    contextMenu.style.top = e.clientY + 'px';
                    contextMenu.style.background = '#18181b';
                    contextMenu.style.border = '2px solid #6366f1';
                    contextMenu.style.borderRadius = '0.5rem';
                    contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
                    contextMenu.style.zIndex = '2147483647'; // max z-index to always be on top
                    contextMenu.style.padding = '0.5em 0';
                    contextMenu.style.minWidth = '120px';
                    contextMenu.style.color = '#f3f4f6';
                    contextMenu.style.fontSize = '1rem';
                    contextMenu.style.display = 'flex';
                    contextMenu.style.flexDirection = 'column';

                    // Delete
                    const delBtn = document.createElement('button');
                    delBtn.textContent = 'Delete Image';
                    delBtn.style.background = 'none';
                    delBtn.style.border = 'none';
                    delBtn.style.color = '#f87171';
                    delBtn.style.padding = '0.5em 1em';
                    delBtn.style.textAlign = 'left';
                    delBtn.style.cursor = 'pointer';
                    delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
                    delBtn.onmouseleave = () => delBtn.style.background = 'none';
                    delBtn.onclick = ev => {
                        ev.stopPropagation();
                        wrapper.remove();
                        contextMenu?.remove();
                        if (editorRef.current) {
                            const event = new Event('input', { bubbles: true });
                            editorRef.current.dispatchEvent(event);
                        }
                    };
                    contextMenu.appendChild(delBtn);

                    // Float left
                    const leftBtn = document.createElement('button');
                    leftBtn.textContent = 'Float Left';
                    leftBtn.style.background = 'none';
                    leftBtn.style.border = 'none';
                    leftBtn.style.color = '#a5b4fc';
                    leftBtn.style.padding = '0.5em 1em';
                    leftBtn.style.textAlign = 'left';
                    leftBtn.style.cursor = 'pointer';
                    leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
                    leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
                    leftBtn.onclick = ev => {
                        ev.stopPropagation();
                        img.style.float = 'left';
                        img.style.display = 'inline';
                        img.style.margin = '0.5em 1em 0.5em 0';
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(leftBtn);

                    // Float right
                    const rightBtn = document.createElement('button');
                    rightBtn.textContent = 'Float Right';
                    rightBtn.style.background = 'none';
                    rightBtn.style.border = 'none';
                    rightBtn.style.color = '#a5b4fc';
                    rightBtn.style.padding = '0.5em 1em';
                    rightBtn.style.textAlign = 'left';
                    rightBtn.style.cursor = 'pointer';
                    rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
                    rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
                    rightBtn.onclick = ev => {
                        ev.stopPropagation();
                        img.style.float = 'right';
                        img.style.display = 'inline';
                        img.style.margin = '0.5em 0 0.5em 1em';
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(rightBtn);

                    // Inline
                    const inlineBtn = document.createElement('button');
                    inlineBtn.textContent = 'Inline';
                    inlineBtn.style.background = 'none';
                    inlineBtn.style.border = 'none';
                    inlineBtn.style.color = '#a5b4fc';
                    inlineBtn.style.padding = '0.5em 1em';
                    inlineBtn.style.textAlign = 'left';
                    inlineBtn.style.cursor = 'pointer';
                    inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
                    inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
                    inlineBtn.onclick = ev => {
                        ev.stopPropagation();
                        img.style.float = '';
                        img.style.display = 'inline-block';
                        img.style.margin = '0.5em 1em 0.5em 0';
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(inlineBtn);

                    // Snap to Grid
                    const gridBtn = document.createElement('button');
                    gridBtn.textContent = 'Snap to Grid';
                    gridBtn.style.background = 'none';
                    gridBtn.style.border = 'none';
                    gridBtn.style.color = '#a5b4fc';
                    gridBtn.style.padding = '0.5em 1em';
                    gridBtn.style.textAlign = 'left';
                    gridBtn.style.cursor = 'pointer';
                    gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
                    gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
                    gridBtn.onclick = ev => {
                        ev.stopPropagation();
                        contextMenu?.remove();
                        showGridOverlay();
                        // Wait for user to click a column
                        gridColumns.current.forEach((col, i) => {
                            col.style.cursor = 'pointer';
                            col.onclick = e => {
                                // Find the closest offset in the editor for this column
                                if (!editorRef.current) return;
                                const rect = editorRef.current.getBoundingClientRect();
                                const colWidth = rect.width / 12;
                                const x = rect.left + i * colWidth + colWidth / 2;
                                let range: Range | null = null;
                                if (document.caretRangeFromPoint) {
                                    range = document.caretRangeFromPoint(x, rect.top + 10); // 10px from top
                                } else if ((document as any).caretPositionFromPoint) {
                                    const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                    if (pos) {
                                        range = document.createRange();
                                        range.setStart(pos.offsetNode, pos.offset);
                                        range.collapse(true);
                                    }
                                }
                                if (range && editorRef.current.contains(range.startContainer)) {
                                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                    if (range.startContainer.nodeType === 3) {
                                        const textNode = range.startContainer as Text;
                                        const offset = range.startOffset;
                                        const before = textNode.textContent?.slice(0, offset) || '';
                                        const after = textNode.textContent?.slice(offset) || '';
                                        const parent = textNode.parentNode;
                                        if (parent) {
                                            if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                            parent.insertBefore(wrapper, textNode);
                                            if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                            if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                        }
                                    } else {
                                        range.insertNode(wrapper);
                                    }
                                    // Insert a zero-width space after if at end
                                    let zwsp: Text | null = null;
                                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                        zwsp = document.createTextNode('\u200B');
                                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                    }
                                    // Move caret after image (and zwsp)
                                    const sel = window.getSelection();
                                    if (sel) {
                                        const r = document.createRange();
                                        if (zwsp) {
                                            r.setStartAfter(zwsp);
                                        } else {
                                            r.setStartAfter(wrapper);
                                        }
                                        r.collapse(true);
                                        sel.removeAllRanges();
                                        sel.addRange(r);
                                        if (editorRef.current) editorRef.current.focus();
                                    }
                                }
                                hideGridOverlay();
                                // Remove click handlers after selection
                                gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                            };
                        });
                    };
                    contextMenu.appendChild(gridBtn);

                    // Untie (Free Move) / Retie (Inline/Float) toggle
                    const untieBtn = document.createElement('button');
                    untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
                    untieBtn.style.background = 'none';
                    untieBtn.style.border = 'none';
                    untieBtn.style.color = '#a5b4fc';
                    untieBtn.style.padding = '0.5em 1em';
                    untieBtn.style.textAlign = 'left';
                    untieBtn.style.cursor = 'pointer';
                    untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
                    untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
                    untieBtn.onclick = ev => {
                        ev.stopPropagation();
                        const isUntied = wrapper.getAttribute('data-untied') === 'true';
                        if (isUntied) {
                            // Retie: revert to inline
                            wrapper.setAttribute('data-untied', 'false');
                            wrapper.style.position = '';
                            wrapper.style.left = '';
                            wrapper.style.top = '';
                            wrapper.style.zIndex = '';
                            wrapper.style.pointerEvents = '';
                            img.style.display = 'block';
                        } else {
                            // Untie: enable free move
                            wrapper.setAttribute('data-untied', 'true');
                            wrapper.style.position = 'absolute';
                            wrapper.style.zIndex = '100';
                            wrapper.style.pointerEvents = 'auto';
                        }
                        contextMenu?.remove();
                    };
                    contextMenu.appendChild(untieBtn);

                    document.body.appendChild(contextMenu);

                    const removeMenu = () => {
                        contextMenu?.remove();
                        contextMenu = null;
                        document.removeEventListener('mousedown', onDocClick);
                    };
                    function onDocClick(ev: MouseEvent) {
                        if (contextMenu && !contextMenu.contains(ev.target as Node)) {
                            removeMenu();
                        }
                    }
                    setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
                });

                // Restore and improve image drag-and-drop
                let dragging = false, ghost: HTMLImageElement | null = null;
                img.addEventListener('mousedown', function(e: MouseEvent) {
                    // Only start drag if not clicking a handle
                    if (e.button !== 0 || e.target === cornerHandle) return;
                    e.preventDefault();
                    const isUntied = wrapper.getAttribute('data-untied') === 'true';
                    dragging = true;
                    img.style.opacity = '0.5';
                    ghost = img.cloneNode(true) as HTMLImageElement;
                    ghost.style.opacity = '0.7';
                    ghost.style.position = 'fixed';
                    ghost.style.pointerEvents = 'none';
                    ghost.style.zIndex = '9999';
                    // Center offset for Untie mode
                    let offsetX = 0, offsetY = 0;
                    if (isUntied) {
                        offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
                        offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
                        ghost.style.left = (e.clientX - offsetX) + 'px';
                        ghost.style.top = (e.clientY - offsetY) + 'px';
                    } else {
                        ghost.style.left = e.clientX + 'px';
                        ghost.style.top = e.clientY + 'px';
                    }
                    document.body.appendChild(ghost);
                    showGridOverlay();

                    function onMouseMove(ev: MouseEvent) {
                        if (!dragging || !ghost) return;
                        if (isUntied) {
                            ghost.style.left = (ev.clientX - img.width / 2) + 'px';
                            ghost.style.top = (ev.clientY - img.height / 2) + 'px';
                        } else {
                            ghost.style.left = ev.clientX + 'px';
                            ghost.style.top = ev.clientY + 'px';
                        }
                        // Highlight nearest grid column
                        if (editorRef.current && gridColumns.current.length) {
                            const rect = editorRef.current.getBoundingClientRect();
                            const x = ev.clientX - rect.left;
                            const colWidth = rect.width / 12;
                            const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                            gridColumns.current.forEach((col, i) => {
                                col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
                            });
                        }
                    }
                    function onMouseUp(ev: MouseEvent) {
                        dragging = false;
                        img.style.opacity = '1';
                        if (ghost) ghost.remove();
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        hideGridOverlay();
                        if (editorRef.current) {
                            const editorRect = editorRef.current.getBoundingClientRect();
                            const imgW = img.width;
                            const imgH = img.height;
                            let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
                            let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
                            // Clamp to editor bounds
                            x = Math.max(0, Math.min(x, editorRect.width - imgW));
                            y = Math.max(0, Math.min(y, editorRect.height - imgH));
                            if (isUntied) {
                                wrapper.setAttribute('data-untied', 'true');
                                wrapper.style.position = 'absolute';
                                wrapper.style.left = x + 'px';
                                wrapper.style.top = y + 'px';
                                wrapper.style.zIndex = '2147483645';
                                wrapper.style.pointerEvents = 'auto';
                                if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                editorRef.current.appendChild(wrapper);
                            } else {
                                // Find the closest offset in the editor for this column
                                const rect = editorRef.current.getBoundingClientRect();
                                const colWidth = rect.width / 12;
                                const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                                const col = gridColumns.current[colIdx];
                                if (col) {
                                    col.style.cursor = 'pointer';
                                    col.onclick = e => {
                                        // Find the closest offset in the editor for this column
                                        if (!editorRef.current) return;
                                        const rect = editorRef.current.getBoundingClientRect();
                                        const colWidth = rect.width / 12;
                                        const x = rect.left + colIdx * colWidth + colWidth / 2;
                                        let range: Range | null = null;
                                        if (document.caretRangeFromPoint) {
                                            range = document.caretRangeFromPoint(x, rect.top + 10); // 10px from top
                                        } else if ((document as any).caretPositionFromPoint) {
                                            const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                            if (pos) {
                                                range = document.createRange();
                                                range.setStart(pos.offsetNode, pos.offset);
                                                range.collapse(true);
                                            }
                                        }
                                        if (range && editorRef.current.contains(range.startContainer)) {
                                            if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                            if (range.startContainer.nodeType === 3) {
                                                const textNode = range.startContainer as Text;
                                                const offset = range.startOffset;
                                                const before = textNode.textContent?.slice(0, offset) || '';
                                                const after = textNode.textContent?.slice(offset) || '';
                                                const parent = textNode.parentNode;
                                                if (parent) {
                                                    if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                                    parent.insertBefore(wrapper, textNode);
                                                    if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                                    if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                                }
                                            } else {
                                                range.insertNode(wrapper);
                                            }
                                            // Insert a zero-width space after if at end
                                            let zwsp: Text | null = null;
                                            if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                                zwsp = document.createTextNode('\u200B');
                                                if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                            }
                                            // Move caret after image (and zwsp)
                                            const sel = window.getSelection();
                                            if (sel) {
                                                const r = document.createRange();
                                                if (zwsp) {
                                                    r.setStartAfter(zwsp);
                                                } else {
                                                    r.setStartAfter(wrapper);
                                                }
                                                r.collapse(true);
                                                sel.removeAllRanges();
                                                sel.addRange(r);
                                                if (editorRef.current) editorRef.current.focus();
                                            }
                                        }
                                        hideGridOverlay();
                                        // Remove click handlers after selection
                                        gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                                    };
                                }
                            }
                        }
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });

                // Insert at caret
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.collapse(false);
                    range.insertNode(wrapper);
                    // Insert a zero-width space after the wrapper if it's at the end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                    // Move caret after image (and zwsp)
                    if (wrapper.nextSibling) {
                        range.setStartAfter(wrapper.nextSibling);
                    } else {
                        range.setStartAfter(wrapper);
                    }
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // Update format state on selection and input
    useEffect(() => {
        function updateFormatState() {
            setFormatState({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strike: document.queryCommandState('strikeThrough'),
            });
        }
        document.addEventListener('selectionchange', updateFormatState);
        if (editorRef.current) {
            editorRef.current.addEventListener('input', updateFormatState);
        }
        return () => {
            document.removeEventListener('selectionchange', updateFormatState);
            if (editorRef.current) {
                editorRef.current.removeEventListener('input', updateFormatState);
            }
        };
    }, []);

    // Place this inside your component, before the return statement:
    function setupImageWrapper(wrapper: HTMLElement | null, img: HTMLImageElement) {
        // If already wrapped, use the wrapper; otherwise, create one
        if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
            wrapper = document.createElement('span');
            wrapper.className = 'docedit-img-wrapper';
            wrapper.style.display = 'inline-block';
            wrapper.style.position = 'relative';
            wrapper.style.width = 'fit-content';
            wrapper.style.height = 'fit-content';
            wrapper.style.padding = '0';
            wrapper.style.margin = '0';
            wrapper.style.background = 'none';
            img.parentNode?.insertBefore(wrapper, img);
            wrapper.appendChild(img);
        }
        // (You can add more setup here if needed, e.g., event listeners, handles, etc.)
    }

    // Update handleLoadDocument to call rehydrateEditor after inserting nodes:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          const doc = JSON.parse(text);
          if (doc && typeof doc.html === 'string') {
            if (editorRef.current) {
                        editorRef.current.innerHTML = doc.html;
                        setEditorHtml(doc.html); // for saving later
                        setTimeout(() => {
                            rehydrateEditor();
                            checkEmpty();
                            toastSave('Document loaded!');
                        }, 0);
                    }
          }
        } catch (err) {
          toast('Failed to load document.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    // When saving, get HTML from editorRef.current.innerHTML
    function saveDocument() {
        if (!editorRef.current) return;
        const html = editorRef.current.innerHTML;
        setEditorHtml(html); // update state for consistency
        // Clone the editor content to avoid modifying the live DOM
        const clone = editorRef.current.cloneNode(true) as HTMLElement;
        // Gather untied images (images not inside a block or grid, or with a special class)
        const images = Array.from(clone.querySelectorAll('img')).map(img => {
            // Get base64 data if possible
            let src = img.src;
            // If the image is a data URL, keep as is; otherwise, try to fetch and convert

            if (!src.startsWith('data:')) {
                // For remote images, skip or fetch as base64 (optional, not implemented here)
            }
            // Collect placement and style info
            return {
                src,
                style: img.getAttribute('style'),
                class: img.getAttribute('class'),
                width: img.width,
                height: img.height,
                alt: img.alt,
                id: img.id,
                parent: img.parentElement?.className || '',
                // Add more attributes as needed
            };
        });
        // Save the HTML (with image srcs as data URLs)
        const doc = {
            type: 'havdoc',
            version: 1,
            html,
            images,
            savedAt: new Date().toISOString()
        };
        // Add magic header
        const magicHeader = 'HAVDOCv1\n';
        const blob = new Blob([
            magicHeader + JSON.stringify(doc, null, 2)
        ], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `document-${Date.now()}.havdoc`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
        toastSave('Document saved!');
    }

    // Update rehydrateEditor to run after React renders new HTML
    function rehydrateEditor() {
        if (!editorRef.current) return;
        editorRef.current.querySelectorAll('img').forEach(img => {
            setupImageWrapper(img.parentElement, img);
        });
    }

    // Add this function so onInput={handleEditorInput} works
    function handleEditorInput() {
        checkEmpty();
    }

    // Render the editor and toolbar
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
                    {/* Gradient outline wrapper */}
                    <div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
                        <div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
                            {/* Beautified Toolbar with site-wide look */}
                            <div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
                                <div className="flex gap-1 items-center">
                                    <button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
                                        <span className="material-symbols-outlined">undo</span>
                                    </button>
                                    <button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
                                        <span className="material-symbols-outlined">redo</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <select
                                        className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
                                        value={blockType}
                                        onChange={e => {
                                            setBlockType(e.target.value);
                                            runCommand('formatBlock', e.target.value);
                                        }}
                                        title="Block type"
                                    >
                                        {BLOCK_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
                                        <span className="material-symbols-outlined">format_list_bulleted</span>
                                    </button>
                                    <button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </button>
                                    <button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
                                        <span className="material-symbols-outlined">format_indent_decrease</span>
                                    </button>
                                    <button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
                                        <span className="material-symbols-outlined">format_indent_increase</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
                                        <span className="material-symbols-outlined">link</span>
                                    </button>
                                    <button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
                                        <span className="material-symbols-outlined">link_off</span>
                                    </button>
                                </div>
                                {/* Save & Extras group at far right */}
                                <div className="flex gap-2 ml-auto items-center">
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Load
                                    </button>
                                    <input
                                        type="file"
                                        accept=".havdoc"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleLoadDocument}
                                    />
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={saveDocument}
                                    >
                                        Save
                                    </button>
                                    <div className="relative">
                                        <button
                                            ref={extrasBtnRef}
                                            type="button"
                                            className="toolbar-btn toolbar-icon"
                                            title="Extras"
                                            onClick={() => setShowExtras(e => !e)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                        {showExtras && createPortal(
                                            (() => {
                                                if (!extrasBtnRef.current) return null;
                                                const rect = extrasBtnRef.current.getBoundingClientRect();
                                                return (
                                                    <div
                                                        className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999]"
                                                        style={{
                                                            top: rect.bottom + 4 + window.scrollY,
                                                            left: rect.right - 224 + window.scrollX, // 224px = menu width
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <b>B</b>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <i>I</i>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <u>U</u>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <s>S</s>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item"
                                                            onClick={() => {
                                                                setShowExtras(false);
                                                                setTimeout(() => imageInputRef.current?.click(), 100);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined align-middle mr-2">image</span>
                                                            Insert Image
                                                        </button>
                                                    </div>
                                                );
                                            })(),
                                            document.body
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleImageInsert}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Editor area */}
                            <div
                                ref={editorRef}
                                className="relative flex-1 min-h-[600px] flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
                                contentEditable
                                suppressContentEditableWarning
                                spellCheck={true}
                                aria-label="Document editor"
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                                onInput={handleEditorInput}
                                style={{flex:1, minHeight:'0'}}
                                onKeyDown={e => {
                                    // Tab/Shift+Tab for indent/outdent
                                    if (e.key === 'Tab') {
                                        e.preventDefault();
                                        if (e.shiftKey) {
                                            handleOutdent();
                                        } else {
                                            handleIndent();
                                        }
                                    }
                                    handleEditorKeyDown(e);
                                }}
                            />
                            {/* Overlay placeholder, absolutely positioned over the editor */}
                            {isEmpty && !isFocused && (
                                <span className="editor-placeholder" style={{
                                    position: 'absolute',
                                    left: '2rem',
                                    top: '2rem',
                                    zIndex: 10,
                                    userSelect: 'none',
                                    pointerEvents: 'none',
                                    color: '#9ca3af',
                                    fontSize: '1rem',
                                    transition: 'opacity 0.15s'
                                }}>
                                    Start your document...
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {/* Loader overlay and fade-in logic remain unchanged */}
            {showLoader && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
                    <span className="loader" aria-label="Loading" />
                </div>
            )}
        </div>
    );

    // Move this to before the return statement so it's in scope for JSX
    function toast(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.innerHTML = `
          <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
          <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
        `;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'rgba(49,46,129,0.98)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 3500);
      }
    }

    // Add a separate toastSave function for the Save button
    function toastSave(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 2000);
      }
    }

    // Add this function inside your component:
    function saveDocument() {
      if (!editorRef.current) return;
      // Clone the editor content to avoid modifying the live DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      // Gather untied images (images not inside a block or grid, or with a special class)
      const images = Array.from(clone.querySelectorAll('img')).map(img => {
        // Get base64 data if possible
        let src = img.src;
        // If the image is a data URL, keep as is; otherwise, try to fetch and convert

        if (!src.startsWith('data:')) {
          // For remote images, skip or fetch as base64 (optional, not implemented here)
        }
        // Collect placement and style info
        return {
          src,
          style: img.getAttribute('style'),
          class: img.getAttribute('class'),
          width: img.width,
          height: img.height,
          alt: img.alt,
          id: img.id,
          parent: img.parentElement?.className || '',
          // Add more attributes as needed
        };
      });
      // Save the HTML (with image srcs as data URLs)
      const html = clone.innerHTML;
      // Bundle into a .havdoc JSON structure
      const doc = {
        type: 'havdoc',
        version: 1,
        html,
        images,
        savedAt: new Date().toISOString()
      };
      // Add magic header
      const magicHeader = 'HAVDOCv1\n';
      const blob = new Blob([
        magicHeader + JSON.stringify(doc, null, 2)
      ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${Date.now()}.havdoc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toastSave('Document saved!');
    }

    // Update rehydrateEditor to run after React renders new HTML
    function rehydrateEditor() {
        if (!editorRef.current) return;
        // For each image, re-apply wrappers and event listeners
        editorRef.current.querySelectorAll('img').forEach(img => {
            // Remove any existing wrapper if present
            if (img.parentElement && img.parentElement.classList.contains('image-wrapper')) {
                // Already wrapped, maybe skip or re-setup
                setupImageWrapper(img.parentElement, img);
            } else {
                // Wrap and setup
                setupImageWrapper(null, img);
            }
        });
        // Optionally, wrap text nodes in <p> or your block element if needed
    }
}

// Working Loading (NO IMAGE EDITING)

"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BLOCK_TYPES = [
	{ label: "Paragraph", value: "P" },
	{ label: "Heading 1", value: "H1" },
	{ label: "Heading 2", value: "H2" },
	{ label: "Heading 3", value: "H3" },
	{ label: "Blockquote", value: "BLOCKQUOTE" },
	{ label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
	const editorRef = useRef<HTMLDivElement>(null);
	const gridOverlay = useRef<HTMLDivElement | null>(null);
	const gridColumns = useRef<HTMLDivElement[]>([]);
	const [blockType, setBlockType] = useState("P");
	const [isEmpty, setIsEmpty] = useState(true);
	const [isFocused, setIsFocused] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [showEditor, setShowEditor] = useState(false);
	const [showLoader, setShowLoader] = useState(true);
	const [showExtras, setShowExtras] = useState(false);
	const [extrasMenuPos, setExtrasMenuPos] = useState<{top:number,left:number,width:number}|null>(null);
	const imageInputRef = useRef<HTMLInputElement>(null);
	const extrasBtnRef = useRef<HTMLButtonElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
	const [editorHtml, setEditorHtml] = useState<string>(""); // keep for save/load, not for rendering
	let gridOverlayEl: HTMLDivElement | null = null;
	let gridColumnsEl: HTMLDivElement[] = [];

	useEffect(() => {
		setMounted(true);
		// Fade in editor after a short delay for smoothness
		const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
		// Fade out loader after editor is visible
		const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
		return () => {
			clearTimeout(fadeInTimeout);
			clearTimeout(loaderTimeout);
		};
	}, []);

	// --- GRID OVERLAY SHOW/HIDE HELPERS ---
	function showGridOverlay() {
		ensureGridOverlay();
		if (gridOverlay.current) {
			gridOverlay.current.style.display = 'flex';
			gridOverlay.current.style.pointerEvents = 'auto';
			gridOverlay.current.style.zIndex = '99999';
		}
	}
	function hideGridOverlay() {
		if (gridOverlay.current) {
			gridOverlay.current.style.display = 'none';
		}
	}

	// Helper to focus editor and run command
	// Update format state immediately after running a command
	const runCommand = (command: string, value?: any) => {
		if (editorRef.current) {
			editorRef.current.focus();
			setTimeout(() => {
				if (value !== undefined) {
					document.execCommand(command, false, value);
				} else {
					document.execCommand(command);
				}
				detectBlockType();
				checkEmpty();
				setFormatState({
					bold: document.queryCommandState('bold'),
					italic: document.queryCommandState('italic'),
					underline: document.queryCommandState('underline'),
					strike: document.queryCommandState('strikeThrough'),
				});
				// --- Use zero-width non-breaking space for bold/strike toggle ---
				if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
					const sel = window.getSelection();
					if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
						let node = sel.anchorNode;
						if (node && node.nodeType === 3 && node.parentElement) {
							let parent = node.parentElement;
							const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
							const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
							if (isBold || isStrike) {
								const offset = sel.anchorOffset;
								const text = node.textContent || '';
								// Split the text node at the caret
								const before = text.slice(0, offset);
								const after = text.slice(offset);
								node.textContent = before;
								// Insert a zero-width non-breaking space after the formatting node
								const zwsp = document.createTextNode('\uFEFF');
								if (parent.nextSibling) {
									parent.parentNode.insertBefore(zwsp, parent.nextSibling);
								} else {
									parent.parentNode.appendChild(zwsp);
								}
								// Move caret to the zwsp
								const range = document.createRange();
								range.setStart(zwsp, 1);
								range.collapse(true);
								sel.removeAllRanges();
								sel.addRange(range);
								// Remove the zwsp on next input
								const cleanup = () => {
									if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
									editorRef.current?.removeEventListener('input', cleanup);
								};
								editorRef.current.addEventListener('input', cleanup);
								// Optionally, also clean up on paste
								editorRef.current.addEventListener('paste', cleanup, { once: true });
							}
						}
					}
				}
			}, 0);
		}
	};

	// Helper for link creation with selection restore
	const handleLink = () => {
		if (!editorRef.current) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;
		const range = selection.getRangeAt(0);
		// Save selection
		const savedRange = range.cloneRange();
		const url = prompt("Enter URL:");
		if (url) {
			editorRef.current.focus();
			// Restore selection
			selection.removeAllRanges();
			selection.addRange(savedRange);
			setTimeout(() => {
				document.execCommand("createLink", false, url);
			}, 0);
		}
	};

	// Detect block type on selection change
	const detectBlockType = () => {
		if (!editorRef.current) return;
		const selection = window.getSelection();
		if (!selection || selection.rangeCount === 0) return;
		let node = selection.anchorNode as HTMLElement | null;
		if (node && node.nodeType === 3) node = node.parentElement;
		while (node && node !== editorRef.current) {
			const tag = node.tagName;
			if (
				tag === "H1" ||
				tag === "H2" ||
				tag === "H3" ||
				tag === "BLOCKQUOTE" ||
				tag === "PRE" ||
				tag === "P"
			) {
				setBlockType(tag);
				return;
			}
			node = node.parentElement;
		}
		setBlockType("P");
	};

	// Check if editor is empty
	const checkEmpty = () => {
		let text = "";
		if (editorRef.current) {
			text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
		} else if (editorHtml) {
			const tempDiv = document.createElement("div");
			tempDiv.innerHTML = editorHtml;
			text = tempDiv.innerText.replace(/\n|\r/g, "").trim();
		}
		setIsEmpty(text === "");
	};

	useEffect(() => {
		document.addEventListener("selectionchange", detectBlockType);
		if (editorRef.current) {
			editorRef.current.addEventListener("input", checkEmpty);
			editorRef.current.addEventListener("blur", checkEmpty);
		}
		return () => {
			document.removeEventListener("selectionchange", detectBlockType);
			if (editorRef.current) {
				editorRef.current.removeEventListener("input", checkEmpty);
				editorRef.current.removeEventListener("blur", checkEmpty);
			}
		};
	}, []);

	// --- GRID OVERLAY DYNAMIC LINES ---
	function updateGridOverlayLines() {
		if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
		const editor = editorRef.current;
		const style = window.getComputedStyle(editor);
		let lineHeight = parseFloat(style.lineHeight);
		if (isNaN(lineHeight)) lineHeight = 28; // fallback
		const editorHeight = editor.offsetHeight;
		const numRows = Math.floor(editorHeight / lineHeight);
		// Remove old horizontal lines
		[...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
		// Add horizontal lines
		for (let r = 1; r < numRows; r++) {
			const hline = document.createElement('div');
			hline.className = 'docedit-grid-hline';
			hline.style.position = 'absolute';
			hline.style.left = '0';
			hline.style.right = '0';
			hline.style.top = (r * lineHeight) + 'px';
			hline.style.height = '0';
			hline.style.borderTop = '1px dashed #818cf8';
			hline.style.pointerEvents = 'none';
			gridOverlay.current.appendChild(hline);
		}
		// Remove old rows from columns
		gridColumns.current.forEach((col) => {
			[...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
		});
	}

	function ensureGridOverlay() {
		if (!editorRef.current) return;
		if (!gridOverlay.current) {
			const overlay = document.createElement('div');
			overlay.className = 'docedit-grid-overlay';
			overlay.style.position = 'absolute';
			overlay.style.top = '0';
			overlay.style.left = '0';
			overlay.style.width = '100%';
			overlay.style.height = '100%';
			overlay.style.pointerEvents = 'auto';
			overlay.style.zIndex = '99999';
			overlay.style.display = 'flex';
			overlay.style.flexDirection = 'row';
			overlay.style.gap = '0';
			gridColumns.current = [];
			for (let i = 0; i < 12; i++) {
				const col = document.createElement('div');
				col.style.flex = '1 1 0';
				col.style.height = '100%';
				col.style.background = 'none';
				col.className = 'docedit-grid-col';
				overlay.appendChild(col);
				gridColumns.current.push(col);
			}
			editorRef.current.appendChild(overlay);
			gridOverlay.current = overlay;
		}
		gridOverlay.current.style.display = 'flex';
		gridOverlay.current.style.pointerEvents = 'auto';
		gridOverlay.current.style.zIndex = '99999';
	}

	// Inject styles only on client
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const styleId = 'docedit-blockstyle';
		if (!document.getElementById(styleId)) {
			const style = document.createElement('style');
			style.id = styleId;
			style.innerHTML = `
			  .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
			  .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
			  .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
			  .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
			  .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
			  .document-editor p { margin: 0.5em 0; }
			  .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
			  .document-editor ul { list-style-type: disc; }
			  .document-editor ol { list-style-type: decimal; }
			  .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
			  .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
			`;
			document.head.appendChild(style);
		}
		// Toolbar styles
		const toolbarStyleId = 'docedit-toolbar-style';
		if (!document.getElementById(toolbarStyleId)) {
			const style = document.createElement('style');
			style.id = toolbarStyleId;
			style.innerHTML = `
				@import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
				.editor-toolbar {
					background: #18181b;
					box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
					border-bottom: 2px solid #52525b;
					padding-left: 1.5rem;
					padding-right: 1.5rem;
					min-height: 3.5rem;
					border-top-left-radius: 0.75rem;
					border-top-right-radius: 0.75rem;
				}
				.toolbar-btn {
					padding: 0.35rem 0.7rem;
					border-radius: 0.375rem;
					background: #27272a;
					color: #f3f4f6;
					font-weight: 500;
					transition: background 0.15s, color 0.15s;
					margin-right: 0.15rem;
					margin-bottom: 0.1rem;
					min-width: 1.7rem;
					min-height: 1.7rem;
					line-height: 1.2;
					font-size: 1.15rem;
					display: inline-flex;
					align-items: center;
					justify-content: center;
					border: none;
					box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
					cursor: pointer;
				}
				.toolbar-btn:focus {
					outline: 2px solid #818cf8;
					outline-offset: 1px;
				}
				.toolbar-btn:hover {
					background: #3f3f46;
					color: #a5b4fc;
				}
				.toolbar-btn:active {
					background: #52525b;
					color: #f3f4f6;
				}
				.toolbar-icon .material-symbols-outlined {
					font-family: 'Material Symbols Outlined', sans-serif;
					font-size: 1.35rem;
					font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
					vertical-align: middle;
					margin: 0;
				}
				.toolbar-dropdown {
					min-width: 8rem;
					font-size: 1.05rem;
					font-weight: 600;
					background: #18181b;
					color: #f3f4f6;
					border: 2px solid #52525b;
					box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
					padding: 0.3rem 0.7rem;
					border-radius: 0.375rem;
				}
				.toolbar-dropdown:focus {
					outline: 2px solid #818cf8;
					outline-offset: 1px;
				}
				.toolbar-btn.menu-item {
				  border: 1.5px solid transparent;
				  transition: border 0.15s, background 0.15s, color 0.15s;
				}
				.toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
				  border: 1.5px solid #818cf8;
				  background: #3f3f46;
				  color: #a5b4fc;
				}
				.toolbar-btn.active {
				  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
				  color: #fff;
				  border: 2px solid #a5b4fc;
				  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
				  text-shadow: 0 0 4px #818cf8;
				}
			`;
			document.head.appendChild(style);
		}
		// Gradient outline styles
		const gradientStyleId = 'docedit-gradient-outline-style';
		if (!document.getElementById(gradientStyleId)) {
			const style = document.createElement('style');
			style.id = gradientStyleId;
			style.innerHTML = `
	.gradient-outline {
	  position: relative;
	  border-radius: 0.75rem;
	  z-index: 1;
	  padding: 3px;
	  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
	  box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
	  transition: box-shadow 0.2s;
	}
	.gradient-outline:focus-within, .gradient-outline:hover {
	  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
	}
	`;
			document.head.appendChild(style);
		}
		// Grid overlay styles
		const gridStyleId = 'docedit-grid-style';
		if (!document.getElementById(gridStyleId)) {
			const style = document.createElement('style');
			style.id = gridStyleId;
			style.innerHTML = `
				.docedit-grid-overlay {
					pointer-events: auto;
					position: absolute;
					top: 0; left: 0; width: 100%; height: 100%;
					z-index: 99999;
					display: flex;
					flex-direction: row;
					gap: 0;
				}
				.docedit-grid-col {
					flex: 1 1 0;
					height: 100%;
					background: rgba(129,140,248,0.18); /* Indigo-400, semi-transparent */
					border-left: 1px solid #6366f1;
					border-right: 1px solid #6366f1;
					position: relative;
					transition: background 0.12s;
				}
				.docedit-grid-col:hover {
					background: rgba(129,140,248,0.35);
				}
				.docedit-grid-row {
					position: absolute;
					left: 0; right: 0;
					height: 0;
					border-top: 1px dashed #818cf8;
					pointer-events: none;
				}
				.docedit-grid-hline {
					position: absolute;
					left: 0;
					right: 0;
					height: 0;
					border-top: 1px dashed #818cf8;
					pointer-events: none;
				}
			`;
			document.head.appendChild(style);
		}
		// Save button gradient hover effect
		const saveBtnStyleId = 'docedit-save-btn-gradient-style';
		if (!document.getElementById(saveBtnStyleId)) {
			const style = document.createElement('style');
			style.id = saveBtnStyleId;
			style.innerHTML = `
				.save-btn-gradient {
				  background: #18181b;
				  border: 2px solid transparent;
				  box-shadow: none;
				  position: relative;
				  z-index: 1;
				  transition: background 0.5s cubic-bezier(.4,2,.6,1),
							  color 0.3s,
							  border 0.4s,
							  box-shadow 0.6s cubic-bezier(.4,2,.6,1);
				}
				.save-btn-gradient:hover, .save-btn-gradient:focus {
				  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
				  color: #fff;
				  border: 2px solid #a78bfa;
				  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
				}
			`;
			document.head.appendChild(style);
		}
	}, []);

	// Observe editor resize and update grid overlay lines
	useEffect(() => {
		if (!editorRef.current) return;
		const editor = editorRef.current;
		let resizeObserver: ResizeObserver | null = null;
		function handleUpdate() {
			updateGridOverlayLines();
		}
		resizeObserver = new window.ResizeObserver(handleUpdate);
		resizeObserver.observe(editor);
		editor.addEventListener('input', handleUpdate);
		setTimeout(handleUpdate, 100);
		return () => {
			resizeObserver?.disconnect();
			editor.removeEventListener('input', handleUpdate);
		};
	}, [editorRef]);

	// Custom list insertion for browsers where execCommand doesn't work
	function insertCustomList(type: 'ul' | 'ol') {
		console.log('insertCustomList called', type); // DEBUG
		const sel = window.getSelection();
		if (!sel) {
			console.log('No selection found');
			return;
		}
		if (!sel.rangeCount) {
			console.log('No range in selection');
			return;
		}
		const range = sel.getRangeAt(0);
		console.log('Range found:', range);
		// Check if selection is inside the editor
		let node = sel.anchorNode;
		let insideEditor = false;
		while (node) {
			if (node === editorRef.current) {
				insideEditor = true;
				break;
			}
			node = node.parentNode;
		}
		console.log('Inside editor:', insideEditor);
		if (!insideEditor) {
			console.log('Selection is not inside the editor.');
			if (editorRef.current) {
				const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
				try {
					document.execCommand('insertHTML', false, html);
					console.log('insertHTML fallback used.');
				} catch {
					editorRef.current.innerHTML += html;
					console.log('innerHTML fallback used.');
				}
			}
			return;
		}
		// If selection is inside a list already, do nothing
		node = sel.anchorNode;
		while (node && node !== document.body) {
			if (node.nodeName === 'UL' || node.nodeName === 'OL') {
				console.log('Already inside a list.');
				return;
			}
			node = node.parentNode;
		}
		// Try insertHTML at caret
		const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
		try {
			document.execCommand('insertHTML', false, html);
			console.log('insertHTML at caret used.');
		} catch {
			// Fallback to range.insertNode
			const list = document.createElement(type);
			const li = document.createElement('li');
			li.innerHTML = '&nbsp;';
			list.appendChild(li);
			range.deleteContents();
			range.insertNode(list);
			console.log('List inserted at caret (range.insertNode fallback).');
		}
		// Move caret into the new list item
		setTimeout(() => {
			const sel2 = window.getSelection();
			if (!sel2) return;
			const editor = editorRef.current;
			if (!editor) return;
			const li = editor.querySelector(type + ' > li');
			if (li) {
				const newRange = document.createRange();
				newRange.setStart(li, 0);
				newRange.collapse(true);
				sel2.removeAllRanges();
				sel2.addRange(newRange);
				console.log('Caret moved into new list item.');
			}
		}, 0);
		// Focus editor after insertion
		if (editorRef && editorRef.current) editorRef.current.focus();
		// Trigger input event to update state
		if (editorRef && editorRef.current) {
			const event = new Event('input', { bubbles: true });
			editorRef.current.dispatchEvent(event);
		}
	}

	// Helper to check if caret is in an empty <li>
	function isCaretInEmptyListItem() {
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) return false;
		const node = sel.anchorNode;
		if (!node) return false;
		const li = node.nodeType === 3 ? node.parentElement : node;
		if (li && li.tagName === 'LI' && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
			return li;
		}
		return false;
	}

	// Enhanced onKeyDown for editor
	const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		// Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
		if (e.ctrlKey && e.shiftKey && e.key === '8') {
			console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
			e.preventDefault();
			insertCustomList('ul');
		}
		if (e.ctrlKey && e.shiftKey && e.key === '7') {
			console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
			e.preventDefault();
			insertCustomList('ol');
		}
		// Exit list on Enter in empty <li>
		if (e.key === 'Enter') {
			const li = isCaretInEmptyListItem();
			if (li) {
				e.preventDefault();
				const ulOrOl = li.parentElement;
				if (!ulOrOl) return;
				const p = document.createElement('p');
				p.innerHTML = '<br>';
				ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
				// Remove the empty li
				li.remove();
				// If list is now empty, remove it
				if (ulOrOl.children.length === 0) ulOrOl.remove();
				// Move caret to new paragraph
				const sel = window.getSelection();
				if (sel) {
					const range = document.createRange();
					range.setStart(p, 0);
					range.collapse(true);
					sel.removeAllRanges();
					sel.addRange(range);
				}
				// Trigger input event
				if (editorRef.current) {
					const event = new Event('input', { bubbles: true });
					editorRef.current.dispatchEvent(event);
				}
			}
		}
	};

	function handleIndent() {
		console.log('handleIndent called'); // DEBUG
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
		let node = sel.anchorNode;
		let li = null;
		const chain = [];
		while (node) {
			chain.push(node.nodeName);
			if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
			node = node.parentNode;
		}
		console.log('Parent chain:', chain);
		if (!li) {
			// Not in a list: insert a tab character at caret
			const range = sel.getRangeAt(0);
			const tabNode = document.createTextNode('\u00A0\u00A0'); // 2 non-breaking spaces for a visual tab
			range.insertNode(tabNode);
			// Move caret after the tab
			range.setStartAfter(tabNode);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
			if (editorRef.current) editorRef.current.focus();
			return;
		}
		// Check if we can indent by moving to a sublist
		const parentList = li.parentElement;
		if (!parentList) { console.log('No parent list'); return; }
		const listType = parentList.nodeName.toLowerCase();
		let prevLi = li.previousElementSibling;
		if (prevLi) {
			let sublist = prevLi.querySelector(listType);
			if (!sublist) {
				sublist = document.createElement(listType);
				prevLi.appendChild(sublist);
			}
			sublist.appendChild(li);
			console.log('Indented li into sublist');
			const range = document.createRange();
			range.setStart(li, 0);
			range.collapse(true);
			if (editorRef.current) editorRef.current.focus();
			sel.removeAllRanges();
			sel.addRange(range);
			const event = new Event('input', { bubbles: true });
			if (editorRef.current) editorRef.current.dispatchEvent(event);
		} else {
			console.log('No previous sibling, cannot indent first item');
			return;
		}
	}

	function handleOutdent() {
		console.log('handleOutdent called'); // DEBUG
		const sel = window.getSelection();
		if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
		let node = sel.anchorNode;
		let li = null;
		const chain = [];
		while (node) {
			chain.push(node.nodeName);
			if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
			node = node.parentNode;
		}
		console.log('Parent chain:', chain);
		if (!li) { console.log('No <li> found'); return; }
		const parentList = li.parentElement;
		const grandList = parentList?.parentElement;
		if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
			// Outdent: move li after its parent list
			grandList.parentElement?.insertBefore(li, grandList.nextSibling);
			if (parentList.children.length === 0) parentList.remove();
			console.log('Outdented li to parent list');
			const range = document.createRange();
			range.setStart(li, 0);
			range.collapse(true);
			if (editorRef.current) editorRef.current.focus();
			sel.removeAllRanges();
			sel.addRange(range);
			const event = new Event('input', { bubbles: true });
			if (editorRef.current) editorRef.current.dispatchEvent(event);
		} else {
			console.log('No grandparent list, cannot outdent');
			return;
		}
	}

	// Add image insert handler
	function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = function(ev) {
			const src = ev.target?.result;
			if (typeof src === 'string' && editorRef.current) {
				const img = document.createElement('img');
				img.src = src;
				img.alt = file.name;
				img.style.margin = '0.5em 1em 0.5em 0';
				img.style.border = '2.5px solid #6366f1';
				img.style.borderRadius = '0.5rem';
				img.style.cursor = 'grab';
				img.setAttribute('contenteditable', 'false');
				img.draggable = false;

				img.onload = function() {
					const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
					if (img.naturalWidth > maxWidth) {
						const scale = maxWidth / img.naturalWidth;
						img.width = Math.round(img.naturalWidth * scale);
						img.height = Math.round(img.naturalHeight * scale);
						img.style.width = img.width + 'px';
						img.style.height = img.height + 'px';
					} else {
						img.width = img.naturalWidth;
						img.height = img.naturalHeight;
						img.style.width = img.naturalWidth + 'px';
						img.style.height = img.naturalHeight + 'px';
					}
				};

				const wrapper = document.createElement('span');
				wrapper.style.display = 'inline-block';
				wrapper.style.position = 'relative';
				wrapper.style.width = 'fit-content';
				wrapper.style.height = 'fit-content';
				wrapper.style.padding = '0';
				wrapper.style.margin = '0';
				wrapper.className = 'docedit-img-wrapper';
				wrapper.style.background = 'none';

				// Ensure image is added to wrapper before controls/handle
				wrapper.appendChild(img);

				// Remove wrapper border/background, only border the image
				img.style.border = '2.5px solid #6366f1';
				img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
				img.style.background = 'none';
				wrapper.style.border = 'none';
				wrapper.style.background = 'none';
				wrapper.style.boxShadow = 'none';

				// Remove overlay controls, add context menu logic
				let contextMenu: HTMLDivElement | null = null;
				img.addEventListener('contextmenu', function(e) {
					e.preventDefault();
					if (contextMenu) contextMenu.remove();
					contextMenu = document.createElement('div');
					contextMenu.className = 'docedit-img-contextmenu';
					contextMenu.style.position = 'fixed';
					contextMenu.style.left = e.clientX + 'px';
					contextMenu.style.top = e.clientY + 'px';
					contextMenu.style.background = '#18181b';
					contextMenu.style.border = '2px solid #6366f1';
					contextMenu.style.borderRadius = '0.5rem';
					contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
					contextMenu.style.zIndex = '2147483647'; // max z-index to always be on top
					contextMenu.style.padding = '0.5em 0';
					contextMenu.style.minWidth = '120px';
					contextMenu.style.color = '#f3f4f6';
					contextMenu.style.fontSize = '1rem';
					contextMenu.style.display = 'flex';
					contextMenu.style.flexDirection = 'column';

					// Delete
					const delBtn = document.createElement('button');
					delBtn.textContent = 'Delete Image';
					delBtn.style.background = 'none';
					delBtn.style.border = 'none';
					delBtn.style.color = '#f87171';
					delBtn.style.padding = '0.5em 1em';
					delBtn.style.textAlign = 'left';
					delBtn.style.cursor = 'pointer';
					delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
					delBtn.onmouseleave = () => delBtn.style.background = 'none';
					delBtn.onclick = ev => {
						ev.stopPropagation();
						wrapper.remove();
						contextMenu?.remove();
						if (editorRef.current) {
							const event = new Event('input', { bubbles: true });
							editorRef.current.dispatchEvent(event);
						}
					};
					contextMenu.appendChild(delBtn);

					// Float left
					const leftBtn = document.createElement('button');
					leftBtn.textContent = 'Float Left';
					leftBtn.style.background = 'none';
					leftBtn.style.border = 'none';
					leftBtn.style.color = '#a5b4fc';
					leftBtn.style.padding = '0.5em 1em';
					leftBtn.style.textAlign = 'left';
					leftBtn.style.cursor = 'pointer';
					leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
					leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
					leftBtn.onclick = ev => {
						ev.stopPropagation();
						img.style.float = 'left';
						img.style.display = 'inline';
						img.style.margin = '0.5em 1em 0.5em 0';
						contextMenu?.remove();
					};
					contextMenu.appendChild(leftBtn);

					// Float right
					const rightBtn = document.createElement('button');
					rightBtn.textContent = 'Float Right';
					rightBtn.style.background = 'none';
					rightBtn.style.border = 'none';
					rightBtn.style.color = '#a5b4fc';
					rightBtn.style.padding = '0.5em 1em';
					rightBtn.style.textAlign = 'left';
					rightBtn.style.cursor = 'pointer';
					rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
					rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
					rightBtn.onclick = ev => {
						ev.stopPropagation();
						img.style.float = 'right';
						img.style.display = 'inline';
						img.style.margin = '0.5em 0 0.5em 1em';
						contextMenu?.remove();
					};
					contextMenu.appendChild(rightBtn);

					// Inline
					const inlineBtn = document.createElement('button');
					inlineBtn.textContent = 'Inline';
					inlineBtn.style.background = 'none';
					inlineBtn.style.border = 'none';
					inlineBtn.style.color = '#a5b4fc';
					inlineBtn.style.padding = '0.5em 1em';
					inlineBtn.style.textAlign = 'left';
					inlineBtn.style.cursor = 'pointer';
					inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
					inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
					inlineBtn.onclick = ev => {
						ev.stopPropagation();
						img.style.float = '';
						img.style.display = 'inline-block';
						img.style.margin = '0.5em 1em 0.5em 0';
						contextMenu?.remove();
					};
					contextMenu.appendChild(inlineBtn);

					// Snap to Grid
					const gridBtn = document.createElement('button');
					gridBtn.textContent = 'Snap to Grid';
					gridBtn.style.background = 'none';
					gridBtn.style.border = 'none';
					gridBtn.style.color = '#a5b4fc';
					gridBtn.style.padding = '0.5em 1em';
					gridBtn.style.textAlign = 'left';
					gridBtn.style.cursor = 'pointer';
					gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
					gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
					gridBtn.onclick = ev => {
						ev.stopPropagation();
						contextMenu?.remove();
						showGridOverlay();
						// Wait for user to click a column
						gridColumns.current.forEach((col, i) => {
							col.style.cursor = 'pointer';
							col.onclick = e => {
								// Find the closest offset in the editor for this column
								if (!editorRef.current) return;
								const rect = editorRef.current.getBoundingClientRect();
								const colWidth = rect.width / 12;
								const x = rect.left + i * colWidth + colWidth / 2;
								let range: Range | null = null;
								if (document.caretRangeFromPoint) {
									range = document.caretRangeFromPoint(x, rect.top + 10); // 10px from top
								} else if ((document as any).caretPositionFromPoint) {
									const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
									if (pos) {
										range = document.createRange();
										range.setStart(pos.offsetNode, pos.offset);
										range.collapse(true);
									}
								}
								if (range && editorRef.current.contains(range.startContainer)) {
									if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
									if (range.startContainer.nodeType === 3) {
										const textNode = range.startContainer as Text;
										const offset = range.startOffset;
										const before = textNode.textContent?.slice(0, offset) || '';
										const after = textNode.textContent?.slice(offset) || '';
										const parent = textNode.parentNode;
										if (parent) {
											if (before) parent.insertBefore(document.createTextNode(before), textNode);
											parent.insertBefore(wrapper, textNode);
											if (after) parent.insertBefore(document.createTextNode(after), textNode);
											if (parent && parent.contains(textNode)) parent.removeChild(textNode);
										}
									} else {
										range.insertNode(wrapper);
									}
									// Insert a zero-width space after if at end
									let zwsp: Text | null = null;
									if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
										zwsp = document.createTextNode('\u200B');
										if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
									}
									// Move caret after image (and zwsp)
									const sel = window.getSelection();
									if (sel) {
										const r = document.createRange();
										if (zwsp) {
											r.setStartAfter(zwsp);
										} else {
											r.setStartAfter(wrapper);
										}
										r.collapse(true);
										sel.removeAllRanges();
										sel.addRange(r);
										if (editorRef.current) editorRef.current.focus();
									}
								}
								hideGridOverlay();
								// Remove click handlers after selection
								gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
							};
						});
					};
					contextMenu.appendChild(gridBtn);

					// Untie (Free Move) / Retie (Inline/Float) toggle
					const untieBtn = document.createElement('button');
					untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
					untieBtn.style.background = 'none';
					untieBtn.style.border = 'none';
					untieBtn.style.color = '#a5b4fc';
					untieBtn.style.padding = '0.5em 1em';
					untieBtn.style.textAlign = 'left';
					untieBtn.style.cursor = 'pointer';
					untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
					untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
					untieBtn.onclick = ev => {
						ev.stopPropagation();
						const isUntied = wrapper.getAttribute('data-untied') === 'true';
						if (isUntied) {
							// Retie: revert to inline
							wrapper.setAttribute('data-untied', 'false');
							wrapper.style.position = '';
							wrapper.style.left = '';
							wrapper.style.top = '';
							wrapper.style.zIndex = '';
							wrapper.style.pointerEvents = '';
							img.style.display = 'block';
						} else {
							// Untie: enable free move
							wrapper.setAttribute('data-untied', 'true');
							wrapper.style.position = 'absolute';
							wrapper.style.zIndex = '100';
							wrapper.style.pointerEvents = 'auto';
						}
						contextMenu?.remove();
					};
					contextMenu.appendChild(untieBtn);

					document.body.appendChild(contextMenu);

					const removeMenu = () => {
						contextMenu?.remove();
						contextMenu = null;
						document.removeEventListener('mousedown', onDocClick);
					};
					function onDocClick(ev: MouseEvent) {
						if (contextMenu && !contextMenu.contains(ev.target as Node)) {
							removeMenu();
						}
					}
					setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
				});

				// Restore and improve image drag-and-drop
				let dragging = false, ghost: HTMLImageElement | null = null;
				img.addEventListener('mousedown', function(e: MouseEvent) {
					// Only start drag if not clicking a handle
					if (e.button !== 0 || e.target === cornerHandle) return;
					e.preventDefault();
					const isUntied = wrapper.getAttribute('data-untied') === 'true';
					dragging = true;
					img.style.opacity = '0.5';
					ghost = img.cloneNode(true) as HTMLImageElement;
					ghost.style.opacity = '0.7';
					ghost.style.position = 'fixed';
					ghost.style.pointerEvents = 'none';
					ghost.style.zIndex = '9999';
					// Center offset for Untie mode
					let offsetX = 0, offsetY = 0;
					if (isUntied) {
						offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
						offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
						ghost.style.left = (e.clientX - offsetX) + 'px';
						ghost.style.top = (e.clientY - offsetY) + 'px';
					} else {
						ghost.style.left = e.clientX + 'px';
						ghost.style.top = e.clientY + 'px';
					}
					document.body.appendChild(ghost);
					showGridOverlay();

					function onMouseMove(ev: MouseEvent) {
						if (!dragging || !ghost) return;
						if (isUntied) {
							ghost.style.left = (ev.clientX - img.width / 2) + 'px';
							ghost.style.top = (ev.clientY - img.height / 2) + 'px';
						} else {
							ghost.style.left = ev.clientX + 'px';
							ghost.style.top = ev.clientY + 'px';
						}
						// Highlight nearest grid column
						if (editorRef.current && gridColumns.current.length) {
							const rect = editorRef.current.getBoundingClientRect();
							const x = ev.clientX - rect.left;
							const colWidth = rect.width / 12;
							const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
							gridColumns.current.forEach((col, i) => {
								col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
							});
						}
					}
					function onMouseUp(ev: MouseEvent) {
						dragging = false;
						img.style.opacity = '1';
						if (ghost) ghost.remove();
						document.removeEventListener('mousemove', onMouseMove);
						document.removeEventListener('mouseup', onMouseUp);
						hideGridOverlay();
						if (editorRef.current) {
							const editorRect = editorRef.current.getBoundingClientRect();
							const imgW = img.width;
							const imgH = img.height;
							let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
							let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
							// Clamp to editor bounds
							x = Math.max(0, Math.min(x, editorRect.width - imgW));
							y = Math.max(0, Math.min(y, editorRect.height - imgH));
							if (isUntied) {
								wrapper.setAttribute('data-untied', 'true');
								wrapper.style.position = 'absolute';
								wrapper.style.left = x + 'px';
								wrapper.style.top = y + 'px';
								wrapper.style.zIndex = '2147483645';
								wrapper.style.pointerEvents = 'auto';
								if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
								editorRef.current.appendChild(wrapper);
							} else {
								// Find the closest offset in the editor for this column
								const rect = editorRef.current.getBoundingClientRect();
								const colWidth = rect.width / 12;
								const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
								const col = gridColumns.current[colIdx];
								if (col) {
									col.style.cursor = 'pointer';
									col.onclick = e => {
										// Find the closest offset in the editor for this column
										if (!editorRef.current) return;
										const rect = editorRef.current.getBoundingClientRect();
										const colWidth = rect.width / 12;
										const x = rect.left + colIdx * colWidth + colWidth / 2;
										let range: Range | null = null;
										if (document.caretRangeFromPoint) {
											range = document.caretRangeFromPoint(x, rect.top + 10); // 10px from top
										} else if ((document as any).caretPositionFromPoint) {
											const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
											if (pos) {
												range = document.createRange();
												range.setStart(pos.offsetNode, pos.offset);
												range.collapse(true);
											}
										}
										if (range && editorRef.current.contains(range.startContainer)) {
											if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
											if (range.startContainer.nodeType === 3) {
												const textNode = range.startContainer as Text;
												const offset = range.startOffset;
												const before = textNode.textContent?.slice(0, offset) || '';
												const after = textNode.textContent?.slice(offset) || '';
												const parent = textNode.parentNode;
												if (parent) {
													if (before) parent.insertBefore(document.createTextNode(before), textNode);
													parent.insertBefore(wrapper, textNode);
													if (after) parent.insertBefore(document.createTextNode(after), textNode);
													if (parent && parent.contains(textNode)) parent.removeChild(textNode);
												}
											} else {
												range.insertNode(wrapper);
											}
											// Insert a zero-width space after if at end
											let zwsp: Text | null = null;
											if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
												zwsp = document.createTextNode('\u200B');
												if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
											}
											// Move caret after image (and zwsp)
											const sel = window.getSelection();
											if (sel) {
												const r = document.createRange();
												if (zwsp) {
													r.setStartAfter(zwsp);
												} else {
													r.setStartAfter(wrapper);
												}
												r.collapse(true);
												sel.removeAllRanges();
												sel.addRange(r);
												if (editorRef.current) editorRef.current.focus();
											}
										}
										hideGridOverlay();
										// Remove click handlers after selection
										gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
									};
								}
							}
						}
					}
					document.addEventListener('mousemove', onMouseMove);
					document.addEventListener('mouseup', onMouseUp);
				});

				// Insert at caret
				const sel = window.getSelection();
				if (sel && sel.rangeCount) {
					const range = sel.getRangeAt(0);
					range.collapse(false);
					range.insertNode(wrapper);
					// Insert a zero-width space after the wrapper if it's at the end
					if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
						const zwsp = document.createTextNode('\u200B');
						if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
					}
					// Move caret after image (and zwsp)
					if (wrapper.nextSibling) {
						range.setStartAfter(wrapper.nextSibling);
					} else {
						range.setStartAfter(wrapper);
					}
					range.collapse(true);
					sel.removeAllRanges();
					sel.addRange(range);
				} else {
					editorRef.current.appendChild(wrapper);
					// Insert a zero-width space after if at end
					if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
						const zwsp = document.createTextNode('\u200B');
						if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
					}
				}
				// Trigger input event
				const event = new Event('input', { bubbles: true });
				editorRef.current.dispatchEvent(event);

				// Make wrapper fit image exactly
				wrapper.style.display = 'inline-block';
				wrapper.style.position = 'relative';
				wrapper.style.width = 'fit-content';
				wrapper.style.height = 'fit-content';
				wrapper.style.padding = '0';
				wrapper.style.margin = '0';

				// Make image block-level so wrapper fits tightly
				img.style.display = 'block';

				// Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
				const cornerHandle = document.createElement('span');
				cornerHandle.className = 'docedit-img-resize-corner';
				cornerHandle.style.position = 'absolute';
				cornerHandle.style.right = '15px'; // move further left into the image
				cornerHandle.style.bottom = '6px';
				cornerHandle.style.width = '18px';
				cornerHandle.style.height = '18px';
				cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
				cornerHandle.style.border = '2.5px solid #6366f1';
				cornerHandle.style.borderRadius = '0 0 0.75rem 0';
				cornerHandle.style.cursor = 'nwse-resize';
				cornerHandle.style.zIndex = '10';
				cornerHandle.title = 'Resize (proportional)';
				cornerHandle.style.display = 'none';
				wrapper.appendChild(cornerHandle);

				// Only make handles non-editable, not the wrapper
				// Remove or comment out:
				// wrapper.setAttribute('contenteditable', 'false');
				// wrapper.style.userSelect = 'none';
				// wrapper.setAttribute('draggable', 'false');
				// wrapper.tabIndex = -1;
				// Keep these for handles only:
				cornerHandle.setAttribute('contenteditable', 'false');
				cornerHandle.style.userSelect = 'none';
				cornerHandle.setAttribute('draggable', 'false');
				cornerHandle.tabIndex = -1;

				// MutationObserver to auto-fix accidental splitting of wrapper
				if (editorRef.current) {
					const observer = new MutationObserver(() => {
						// If wrapper is split, merge it back
						if (wrapper.parentNode && wrapper.childNodes.length > 1) {
							const imgs = wrapper.querySelectorAll('img');
							if (imgs.length === 1 && wrapper.childNodes.length > 3) {
								// Remove any accidental text nodes or elements between handles and image
								[...wrapper.childNodes].forEach(node => {
									if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
								});
							}
						}
					});
					observer.observe(wrapper, { childList: true, subtree: true });
				}

				// Show handles on hover/focus
				wrapper.onmouseenter = () => {
					cornerHandle.style.display = 'block';
				};
				wrapper.onmouseleave = () => {
					cornerHandle.style.display = 'none';
				};
				img.onfocus = () => {
					cornerHandle.style.display = 'block';
				};
				img.onblur = () => {
					cornerHandle.style.display = 'none';
				};

				// Proportional resize (corner)
				let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
				function setImgSize(w: number, h: number) {
					img.width = w;
					img.height = h;
					img.style.width = w + 'px';
					img.style.height = h + 'px';
				}
				cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
					e.preventDefault();
					e.stopPropagation();
					resizing = true;
					startX = e.clientX;
					startY = e.clientY;
					startY = e.clientY;
					startWidth = img.width || img.naturalWidth;
					startHeight = img.height || img.naturalHeight;
					aspect = startWidth / startHeight;
					document.body.style.userSelect = 'none';
					function onMouseMove(ev: MouseEvent) {
						if (!resizing) return;
						const dx = ev.clientX - startX;
						let newWidth = Math.max(40, startWidth + dx);
						let newHeight = Math.max(40, newWidth / aspect);
						setImgSize(newWidth, newHeight);
					}
					function onMouseUp() {
						resizing = false;
						document.removeEventListener('mousemove', onMouseMove);
						document.removeEventListener('mouseup', onMouseUp);
						document.body.style.userSelect = '';
					}
					document.addEventListener('mousemove', onMouseMove);
					document.addEventListener('mouseup', onMouseUp);
				});
			}
		};
		reader.readAsDataURL(file);
		e.target.value = '';
	}

	// Update format state on selection and input
	useEffect(() => {
		function updateFormatState() {
			setFormatState({
				bold: document.queryCommandState('bold'),
				italic: document.queryCommandState('italic'),
				underline: document.queryCommandState('underline'),
				strike: document.queryCommandState('strikeThrough'),
			});
		}
		document.addEventListener('selectionchange', updateFormatState);
		if (editorRef.current) {
			editorRef.current.addEventListener('input', updateFormatState);
		}
		return () => {
			document.removeEventListener('selectionchange', updateFormatState);
			if (editorRef.current) {
				editorRef.current.removeEventListener('input', updateFormatState);
			}
		};
	}, []);

	// Place this inside your component, before the return statement:
	function setupImageWrapper(wrapper: HTMLElement | null, img: HTMLImageElement) {
	    // If already wrapped, use the wrapper; otherwise, create one
	    if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
	        wrapper = document.createElement('span');
	        wrapper.className = 'docedit-img-wrapper';
	        wrapper.style.display = 'inline-block';
	        wrapper.style.position = 'relative';
	        wrapper.style.width = 'fit-content';
	        wrapper.style.height = 'fit-content';
	        wrapper.style.padding = '0';
	        wrapper.style.margin = '0';
	        wrapper.style.background = 'none';
	        img.parentNode?.insertBefore(wrapper, img);
	        wrapper.appendChild(img);
	    }
	    // (You can add more setup here if needed, e.g., event listeners, handles, etc.)
	}

	// Update handleLoadDocument to call rehydrateEditor after inserting nodes:
	function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
	  const file = e.target.files?.[0];
	  if (!file) return;
	  const reader = new FileReader();
	  reader.onload = async function(ev) {
	    try {
	      let text = ev.target?.result as string;
	      if (text.startsWith('HAVDOCv1')) {
	        text = text.replace(/^HAVDOCv1\n/, '');
	      }
	      const doc = JSON.parse(text);
	      if (doc && typeof doc.html === 'string') {
	        if (editorRef.current) {
						editorRef.current.innerHTML = doc.html;
						setEditorHtml(doc.html); // for saving later
						setTimeout(() => {
							rehydrateEditor();
							checkEmpty();
							toastSave('Document loaded!');
						}, 0);
					}
	      }
	    } catch (err) {
	      toast('Failed to load document.');
	    }
	  };
	  reader.readAsText(file);
	  e.target.value = '';
	}

	// When saving, get HTML from editorRef.current.innerHTML
	function saveDocument() {
		if (!editorRef.current) return;
		const html = editorRef.current.innerHTML;
		setEditorHtml(html); // update state for consistency
		// Clone the editor content to avoid modifying the live DOM
		const clone = editorRef.current.cloneNode(true) as HTMLElement;
		// Gather untied images (images not inside a block or grid, or with a special class)
		const images = Array.from(clone.querySelectorAll('img')).map(img => {
			// Get base64 data if possible
			let src = img.src;
			// If the image is a data URL, keep as is; otherwise, try to fetch and convert

			if (!src.startsWith('data:')) {
				// For remote images, skip or fetch as base64 (optional, not implemented here)
			}
			// Collect placement and style info
			return {
				src,
				style: img.getAttribute('style'),
				class: img.getAttribute('class'),
				width: img.width,
				height: img.height,
				alt: img.alt,
				id: img.id,
				parent: img.parentElement?.className || '',
				// Add more attributes as needed
			};
		});
		// Save the HTML (with image srcs as data URLs)
		const doc = {
			type: 'havdoc',
			version: 1,
			html,
			images,
			savedAt: new Date().toISOString()
		};
		// Add magic header
		const magicHeader = 'HAVDOCv1\n';
		const blob = new Blob([
			magicHeader + JSON.stringify(doc, null, 2)
		], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `document-${Date.now()}.havdoc`;
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		}, 100);
		toastSave('Document saved!');
	}

	// Update rehydrateEditor to run after React renders new HTML
	function rehydrateEditor() {
		if (!editorRef.current) return;
		editorRef.current.querySelectorAll('img').forEach(img => {
			let wrapper = img.parentElement;
			// If not already wrapped, wrap it
			if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
				wrapper = document.createElement('span');
				wrapper.className = 'docedit-img-wrapper';
				wrapper.style.display = 'inline-block';
				wrapper.style.position = 'relative';
				wrapper.style.width = 'fit-content';
				wrapper.style.height = 'fit-content';
				wrapper.style.padding = '0';
				wrapper.style.margin = '0';
				wrapper.style.background = 'none';
				img.parentNode?.insertBefore(wrapper, img);
				wrapper.appendChild(img);
			}
			// Restore tied/untied state
			const isUntied = wrapper.getAttribute('data-untied') === 'true';
			if (isUntied) {
				wrapper.style.position = 'absolute';
				wrapper.style.zIndex = '100';
				wrapper.style.pointerEvents = 'auto';
				// Restore left/top if present
				if (wrapper.style.left) wrapper.style.left = wrapper.style.left;
				if (wrapper.style.top) wrapper.style.top = wrapper.style.top;
			} else {
				wrapper.style.position = '';
				wrapper.style.left = '';
				wrapper.style.top = '';
				wrapper.style.zIndex = '';
				wrapper.style.pointerEvents = '';
			}
			// Add handle if not present
			if (!wrapper.querySelector('.docedit-img-resize-corner')) {
				const cornerHandle = document.createElement('span');
				cornerHandle.className = 'docedit-img-resize-corner';
				cornerHandle.style.position = 'absolute';
				cornerHandle.style.right = '15px';
				cornerHandle.style.bottom = '6px';
				cornerHandle.style.width = '18px';
				cornerHandle.style.height = '18px';
				cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
				cornerHandle.style.border = '2.5px solid #6366f1';
				cornerHandle.style.borderRadius = '0 0 0.75rem 0';
				cornerHandle.style.cursor = 'nwse-resize';
				cornerHandle.style.zIndex = '10';
				cornerHandle.title = 'Resize (proportional)';
				cornerHandle.style.display = 'none';
				cornerHandle.setAttribute('contenteditable', 'false');
				cornerHandle.style.userSelect = 'none';
				cornerHandle.setAttribute('draggable', 'false');
				cornerHandle.tabIndex = -1;
				wrapper.appendChild(cornerHandle);

				// Show handles on hover/focus
				wrapper.onmouseenter = () => { cornerHandle.style.display = 'block'; };
				wrapper.onmouseleave = () => { cornerHandle.style.display = 'none'; };
				img.onfocus = () => { cornerHandle.style.display = 'block'; };
				img.onblur = () => { cornerHandle.style.display = 'none'; };

				// Proportional resize (corner)
				let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
				function setImgSize(w: number, h: number) {
					img.width = w;
					img.height = h;
					img.style.width = w + 'px';
					img.style.height = h + 'px';
				}
				cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
					e.preventDefault();
					e.stopPropagation();
					resizing = true;
					startX = e.clientX;
					startY = e.clientY;
					startY = e.clientY;
					startWidth = img.width || img.naturalWidth;
					startHeight = img.height || img.naturalHeight;
					aspect = startWidth / startHeight;
					document.body.style.userSelect = 'none';
					function onMouseMove(ev: MouseEvent) {
						if (!resizing) return;
						const dx = ev.clientX - startX;
						let newWidth = Math.max(40, startWidth + dx);
						let newHeight = Math.max(40, newWidth / aspect);
						setImgSize(newWidth, newHeight);
					}
					function onMouseUp() {
						resizing = false;
						document.removeEventListener('mousemove', onMouseMove);
						document.removeEventListener('mouseup', onMouseUp);
						document.body.style.userSelect = '';
					}
					document.addEventListener('mousemove', onMouseMove);
					document.addEventListener('mouseup', onMouseUp);
				});
			}
		});
	}

	// Add this function so onInput={handleEditorInput} works
	function handleEditorInput() {
		checkEmpty();
	}

	// Render the editor and toolbar
	return (
		<div className="min-h-screen bg-gray-800 text-white flex flex-col">
			<div className="flex-1 flex flex-col items-center justify-center">
				<div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
					{/* Gradient outline wrapper */}
					<div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
						<div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
							{/* Toolbar ...existing code... */}
							<div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
								<div className="flex gap-1 items-center">
									<button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
										<span className="material-symbols-outlined">undo</span>
									</button>
									<button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
										<span className="material-symbols-outlined">redo</span>
									</button>
								</div>
								<div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
									<select
										className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
										value={blockType}
										onChange={e => {
											setBlockType(e.target.value);
											runCommand('formatBlock', e.target.value);
										}}
										title="Block type"
									>
										{BLOCK_TYPES.map(opt => (
											<option key={opt.value} value={opt.value}>{opt.label}</option>
										))}
									</select>
								</div>
								<div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
									<button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
										<span className="material-symbols-outlined">format_list_bulleted</span>
									</button>
									<button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
										<span className="material-symbols-outlined">format_list_numbered</span>
									</button>
									<button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
										<span className="material-symbols-outlined">format_indent_decrease</span>
									</button>
									<button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
										<span className="material-symbols-outlined">format_indent_increase</span>
									</button>
								</div>
								<div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
									<button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
										<span className="material-symbols-outlined">link</span>
									</button>
									<button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
										<span className="material-symbols-outlined">link_off</span>
									</button>
								</div>
								{/* Save & Extras group at far right */}
								<div className="flex gap-2 ml-auto items-center">
									<button
										type="button"
										className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
										style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
										onClick={() => fileInputRef.current?.click()}
									>
										Load
									</button>
									<input
										type="file"
										accept=".havdoc"
										ref={fileInputRef}
										style={{ display: 'none' }}
										onChange={handleLoadDocument}
									/>
									<button
										type="button"
										className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
										style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
										onClick={saveDocument}
									>
										Save
									</button>
									<div className="relative">
										<button
											ref={extrasBtnRef}
											type="button"
											className="toolbar-btn toolbar-icon"
											title="Extras"
											onClick={() => setShowExtras(e => !e)}
										>
											<span className="material-symbols-outlined">more_vert</span>
										</button>
										{showExtras && createPortal(
											(() => {
												if (!extrasBtnRef.current) return null;
												const rect = extrasBtnRef.current.getBoundingClientRect();
												return (
													<div
														className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999]"
														style={{
															top: rect.bottom + 4 + window.scrollY,
															left: rect.right - 224 + window.scrollX, // 224px = menu width
														}}
													>
														<button
															type="button"
															className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
															onClick={() => toast('coming soon')}
														>
															<b>B</b>
															<span className="text-xs ml-2">(Coming Soon)</span>
														</button>
														<button
															type="button"
															className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
															onClick={() => toast('coming soon')}
														>
															<i>I</i>
															<span className="text-xs ml-2">(Coming Soon)</span>
														</button>
														<button
															type="button"
															className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
															onClick={() => toast('coming soon')}
														>
															<u>U</u>
															<span className="text-xs ml-2">(Coming Soon)</span>
														</button>
																											<button
															type="button"
															className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
															onClick={() => toast('coming soon')}
														>
															<s>S</s>
															<span className="text-xs ml-2">(Coming Soon)</span>
														</button>
														<button
															type="button"
															className="w-full text-left px-4 py-2 toolbar-btn menu-item"
															onClick={() => {
																setShowExtras(false);
																setTimeout(() => imageInputRef.current?.click(), 100);
															}}
														>
															<span className="material-symbols-outlined align-middle mr-2">image</span>
															Insert Image
														</button>
													</div>
												);
											})(),
											document.body
										)}
										<input
											type="file"
											accept="image/*"
											ref={imageInputRef}
											style={{ display: 'none' }}
											onChange={handleImageInsert}
										/>
									</div>
								</div>
							</div>
							{/* Editor area and placeholder wrapper */}
							<div style={{position: 'relative', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
								<div
									ref={editorRef}
									className="flex-1 flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
									contentEditable
									suppressContentEditableWarning
									spellCheck={true}
									aria-label="Document editor"
									onFocus={() => setIsFocused(true)}
									onBlur={() => setIsFocused(false)}
									onInput={handleEditorInput}
									style={{flex:1, minHeight:'0'}}
									onKeyDown={e => {
										if (e.key === 'Tab') {
											e.preventDefault();
											if (e.shiftKey) {
												handleOutdent();
											} else {
												handleIndent();
											}
										}
										handleEditorKeyDown(e);
									}}
								/>
								{/* Overlay placeholder, absolutely positioned over the editor area */}
								{isEmpty && !isFocused && (
									<span className="editor-placeholder" style={{
										position: 'absolute',
										left: '2.5rem',
										top: '2.5rem',
										zIndex: 10,
										userSelect: 'none',
										pointerEvents: 'none',
										color: '#9ca3af',
										fontSize: '1rem',
										transition: 'opacity 0.15s'
									}}>
										Start your document...
									</span>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
			{/* Loader overlay and fade-in logic remain unchanged */}
			{showLoader && (
				<div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
					<span className="loader" aria-label="Loading" />
				</div>
			)}
		</div>
	);

	// Move this to before the return statement so it's in scope for JSX
	function toast(msg: string) {
	  if (typeof window !== 'undefined') {
	    let toast = document.createElement('div');
	    toast.innerHTML = `
	      <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
	      <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
	    `;
	    toast.style.position = 'fixed';
	    toast.style.bottom = '2rem';
	    toast.style.right = '-400px';
	    toast.style.background = 'rgba(49,46,129,0.98)';
	    toast.style.color = '#fff';
	    toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
	    toast.style.borderRadius = '0.7rem';
	    toast.style.fontSize = '1.05rem';
	    toast.style.zIndex = '2147483647';
	    toast.style.boxShadow = '0 2px 16px 0 #312e81';
	    toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
	    toast.style.opacity = '1';
	    document.body.appendChild(toast);
	    setTimeout(() => { toast.style.right = '2rem'; }, 10);
	    setTimeout(() => {
	      toast.style.opacity = '0';
	      toast.style.right = '-400px';
	      setTimeout(() => toast.remove(), 400);
	    }, 3500);
	  }
	}

	// Add a separate toastSave function for the Save button
	function toastSave(msg: string) {
	  if (typeof window !== 'undefined') {
	    let toast = document.createElement('div');
	    toast.textContent = msg;
	    toast.style.position = 'fixed';
	    toast.style.bottom = '2rem';
	    toast.style.right = '-400px';
	    toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
	    toast.style.color = '#fff';
	    toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
	    toast.style.borderRadius = '0.7rem';
	    toast.style.fontSize = '1.05rem';
	    toast.style.zIndex = '2147483647';
	    toast.style.boxShadow = '0 2px 16px 0 #312e81';
	    toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
	    toast.style.opacity = '1';
	    document.body.appendChild(toast);
	    setTimeout(() => { toast.style.right = '2rem'; }, 10);
	    setTimeout(() => {
	      toast.style.opacity = '0';
	      toast.style.right = '-400px';
	      setTimeout(() => toast.remove(), 400);
	    }, 2000);
	  }
	}

	// Add this function inside your component:
	function saveDocument() {
	  if (!editorRef.current) return;
	  // Clone the editor content to avoid modifying the live DOM
	  const clone = editorRef.current.cloneNode(true) as HTMLElement;
	  // Gather untied images (images not inside a block or grid, or with a special class)
	  const images = Array.from(clone.querySelectorAll('img')).map(img => {
	    // Get base64 data if possible
	    let src = img.src;
	    // If the image is a data URL, keep as is; otherwise, try to fetch and convert

	    if (!src.startsWith('data:')) {
	      // For remote images, skip or fetch as base64 (optional, not implemented here)
	    }
	    // Collect placement and style info
	    return {
	      src,
	      style: img.getAttribute('style'),
	      class: img.getAttribute('class'),
	      width: img.width,
	      height: img.height,
	      alt: img.alt,
	      id: img.id,
	      parent: img.parentElement?.className || '',
	      // Add more attributes as needed
	    };
	  });
	  // Save the HTML (with image srcs as data URLs)
	  const html = clone.innerHTML;
	  // Bundle into a .havdoc JSON structure
	  const doc = {
	    type: 'havdoc',
	    version: 1,
	    html,
	    images,
	    savedAt: new Date().toISOString()
	  };
	  // Add magic header
	  const magicHeader = 'HAVDOCv1\n';
	  const blob = new Blob([
	    magicHeader + JSON.stringify(doc, null, 2)
	  ], { type: 'application/json' });
	  const url = URL.createObjectURL(blob);
	  const a = document.createElement('a');
	  a.href = url;
	  a.download = `document-${Date.now()}.havdoc`;
	  document.body.appendChild(a);
	  a.click();
	  setTimeout(() => {
	    document.body.removeChild(a);
	    URL.revokeObjectURL(url);
	  }, 100);
	  toastSave('Document saved!');
	}

	// Update rehydrateEditor to run after React renders new HTML
	function rehydrateEditor() {
		if (!editorRef.current) return;
		// For each image, re-apply wrappers and event listeners
		editorRef.current.querySelectorAll('img').forEach(img => {
			// Remove any existing wrapper if present
			if (img.parentElement && img.parentElement.classList.contains('image-wrapper')) {
				// Already wrapped, maybe skip or re-setup
				setupImageWrapper(img.parentElement, img);
			} else {
				// Wrap and setup
				setupImageWrapper(null, img);
			}
		});
		// Optionally, wrap text nodes in <p> or your block element if needed
	}
}


///MILESTONE WORKING SAVE AND LOAD

"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BLOCK_TYPES = [
    { label: "Paragraph", value: "P" },
    { label: "Heading 1", value: "H1" },
    { label: "Heading 2", value: "H2" },
    { label: "Heading 3", value: "H3" },
    { label: "Blockquote", value: "BLOCKQUOTE" },
    { label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
    const editorRef = useRef<HTMLDivElement>(null);
    const gridOverlay = useRef<HTMLDivElement | null>(null);
    const gridColumns = useRef<HTMLDivElement[]>([]);
    const [blockType, setBlockType] = useState("P");
    const [isEmpty, setIsEmpty] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [showExtras, setShowExtras] = useState(false);
    const [extrasMenuPos, setExtrasMenuPos] = useState<{top:number,left:number,width:number}|null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const extrasBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
    const [editorHtml, setEditorHtml] = useState<string>(""); // keep for save/load, not for rendering
    let gridOverlayEl: HTMLDivElement | null = null;
    let gridColumnsEl: HTMLDivElement[] = [];

    useEffect(() => {
        setMounted(true);
        // Fade in editor after a short delay for smoothness
        const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
        // Fade out loader after editor is visible
        const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
        return () => {
            clearTimeout(fadeInTimeout);
            clearTimeout(loaderTimeout);
        };
    }, []);

    // --- GRID OVERLAY SHOW/HIDE HELPERS ---
    function showGridOverlay() {
        ensureGridOverlay();
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'flex';
            gridOverlay.current.style.pointerEvents = 'auto';
            gridOverlay.current.style.zIndex = '99999';
        }
    }
    function hideGridOverlay() {
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'none';
        }
    }

    // Helper to focus editor and run command
    // Update format state immediately after running a command
    const runCommand = (command: string, value?: any) => {
        if (editorRef.current) {
            editorRef.current.focus();
            setTimeout(() => {
                if (value !== undefined) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command);
                }
                detectBlockType();
                checkEmpty();
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                });
                // --- Use zero-width non-breaking space for bold/strike toggle ---
                if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
                        let node = sel.anchorNode;
                        if (node && node.nodeType === 3 && node.parentElement) {
                            let parent = node.parentElement;
                            const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
                            const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
                            if (isBold || isStrike) {
                                const offset = sel.anchorOffset;
                                const text = node.textContent || '';
                                // Split the text node at the caret
                                const before = text.slice(0, offset);
                                const after = text.slice(offset);
                                node.textContent = before;
                                // Insert a zero-width non-breaking space after the formatting node
                                const zwsp = document.createTextNode('\uFEFF');
                                if (parent.nextSibling) {
                                    parent.parentNode.insertBefore(zwsp, parent.nextSibling);
                                } else {
                                    parent.parentNode.appendChild(zwsp);
                                }
                                // Move caret to the zwsp
                                const range = document.createRange();
                                range.setStart(zwsp, 1);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Remove the zwsp on next input
                                const cleanup = () => {
                                    if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
                                    editorRef.current?.removeEventListener('input', cleanup);
                                };
                                editorRef.current.addEventListener('input', cleanup);
                                // Optionally, also clean up on paste
                                editorRef.current.addEventListener('paste', cleanup, { once: true });
                            }
                        }
                    }
                }
            }, 0);
        }
    };

    // Helper for link creation with selection restore
    const handleLink = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        // Save selection
        const savedRange = range.cloneRange();
        const url = prompt("Enter URL:");
        if (url) {
            editorRef.current.focus();
            // Restore selection
            selection.removeAllRanges();
            selection.addRange(savedRange);
            setTimeout(() => {
                document.execCommand("createLink", false, url);
            }, 0);
        }
    };

    // Detect block type on selection change
    const detectBlockType = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.anchorNode as HTMLElement | null;
        if (node && node.nodeType === 3) node = node.parentElement;
        while (node && node !== editorRef.current) {
            const tag = node.tagName;
            if (
                tag === "H1" ||
                tag === "H2" ||
                tag === "H3" ||
                tag === "BLOCKQUOTE" ||
                tag === "PRE" ||
                tag === "P"
            ) {
                setBlockType(tag);
                return;
            }
            node = node.parentElement;
        }
        setBlockType("P");
    };

    // Check if editor is empty
    const checkEmpty = () => {
        let text = "";
        if (editorRef.current) {
            text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
        } else if (editorHtml) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = editorHtml;
            text = tempDiv.innerText.replace(/\n|\r/g, "").trim();
        }
        setIsEmpty(text === "");
    };

    useEffect(() => {
        document.addEventListener("selectionchange", detectBlockType);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", checkEmpty);
            editorRef.current.addEventListener("blur", checkEmpty);
        }
        return () => {
            document.removeEventListener("selectionchange", detectBlockType);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", checkEmpty);
                editorRef.current.removeEventListener("blur", checkEmpty);
            }
        };
    }, []);

    // --- GRID OVERLAY DYNAMIC LINES ---
    function updateGridOverlayLines() {
        if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
        const editor = editorRef.current;
        const style = window.getComputedStyle(editor);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) lineHeight = 28; // fallback
        const editorHeight = editor.offsetHeight;
        const numRows = Math.floor(editorHeight / lineHeight);
        // Remove old horizontal lines
        [...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
        // Add horizontal lines
        for (let r = 1; r < numRows; r++) {
            const hline = document.createElement('div');
            hline.className = 'docedit-grid-hline';
            hline.style.position = 'absolute';
            hline.style.left = '0';
            hline.style.right = '0';
            hline.style.top = (r * lineHeight) + 'px';
            hline.style.height = '0';
            hline.style.borderTop = '1px dashed #818cf8';
            hline.style.pointerEvents = 'none';
            gridOverlay.current.appendChild(hline);
        }
        // Remove old rows from columns
        gridColumns.current.forEach((col) => {
            [...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
        });
    }

    function ensureGridOverlay() {
        if (!editorRef.current) return;
        if (!gridOverlay.current) {
            const overlay = document.createElement('div');
            overlay.className = 'docedit-grid-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'row';
            overlay.style.gap = '0';
            gridColumns.current = [];
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.style.flex = '1 1 0';
                col.style.height = '100%';
                col.style.background = 'none';
                col.className = 'docedit-grid-col';
                overlay.appendChild(col);
                gridColumns.current.push(col);
            }
            editorRef.current.appendChild(overlay);
            gridOverlay.current = overlay;
        }
        gridOverlay.current.style.display = 'flex';
        gridOverlay.current.style.pointerEvents = 'auto';
        gridOverlay.current.style.zIndex = '99999';
    }

    // Inject styles only on client
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const styleId = 'docedit-blockstyle';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
              .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
              .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
              .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
              .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
              .document-editor p { margin: 0.5em 0; }
              .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
              .document-editor ul { list-style-type: disc; }
              .document-editor ol { list-style-type: decimal; }
              .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
              .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
            `;
            document.head.appendChild(style);
        }
        // Toolbar styles
        const toolbarStyleId = 'docedit-toolbar-style';
        if (!document.getElementById(toolbarStyleId)) {
            const style = document.createElement('style');
            style.id = toolbarStyleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                .editor-toolbar {
                    background: #18181b;
                    box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
                    border-bottom: 2px solid #52525b;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                    min-height: 3.5rem;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                }
                .toolbar-btn {
                    padding: 0.35rem 0.7rem;
                    border-radius: 0.375rem;
                    background: #27272a;
                    color: #f3f4f6;
                    font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    margin-right: 0.15rem;
                    margin-bottom: 0.1rem;
                    min-width: 1.7rem;
                    min-height: 1.7rem;
                    line-height: 1.2;
                    font-size: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    cursor: pointer;
                }
                .toolbar-btn:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn:hover {
                    background: #3f3f46;
                    color: #a5b4fc;
                }
                .toolbar-btn:active {
                    background: #52525b;
                    color: #f3f4f6;
                }
                .toolbar-icon .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined', sans-serif;
                    font-size: 1.35rem;
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    vertical-align: middle;
                    margin: 0;
                }
                .toolbar-dropdown {
                    min-width: 8rem;
                    font-size: 1.05rem;
                    font-weight: 600;
                    background: #18181b;
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    padding: 0.3rem 0.7rem;
                    border-radius: 0.375rem;
                }
                .toolbar-dropdown:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn.menu-item {
                  border: 1.5px solid transparent;
                  transition: border 0.15s, background 0.15s, color 0.15s;
                }
                .toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
                  border: 1.5px solid #818cf8;
                  background: #3f3f46;
                  color: #a5b4fc;
                }
                .toolbar-btn.active {
                  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
                  color: #fff;
                  border: 2px solid #a5b4fc;
                  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
                  text-shadow: 0 0 4px #818cf8;
                }
            `;
            document.head.appendChild(style);
        }
        // Gradient outline styles
        const gradientStyleId = 'docedit-gradient-outline-style';
        if (!document.getElementById(gradientStyleId)) {
            const style = document.createElement('style');
            style.id = gradientStyleId;
            style.innerHTML = `
    .gradient-outline {
      position: relative;
      border-radius: 0.75rem;
      z-index: 1;
      padding: 3px;
      background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
      transition: box-shadow 0.2s;
    }
    .gradient-outline:focus-within, .gradient-outline:hover {
      box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
    }
    `;
            document.head.appendChild(style);
        }
        // Grid overlay styles
        const gridStyleId = 'docedit-grid-style';
        if (!document.getElementById(gridStyleId)) {
            const style = document.createElement('style');
            style.id = gridStyleId;
            style.innerHTML = `
                .docedit-grid-overlay {
                    pointer-events: auto;
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 99999;
                    display: flex;
                    flex-direction: row;
                    gap: 0;
                }
                .docedit-grid-col {
                    flex: 1 1 0;
                    height: 100%;
                    background: rgba(129,140,248,0.18); /* Indigo-400, semi-transparent */
                    border-left: 1px solid #6366f1;
                    border-right: 1px solid #6366f1;
                    position: relative;
                    transition: background 0.12s;
                }
                .docedit-grid-col:hover {
                    background: rgba(129,140,248,0.35);
                }
                .docedit-grid-row {
                    position: absolute;
                    left: 0; right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
                .docedit-grid-hline {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Save button gradient hover effect
        const saveBtnStyleId = 'docedit-save-btn-gradient-style';
        if (!document.getElementById(saveBtnStyleId)) {
            const style = document.createElement('style');
            style.id = saveBtnStyleId;
            style.innerHTML = `
                .save-btn-gradient {
                  background: #18181b;
                  border: 2px solid transparent;
                  box-shadow: none;
                  position: relative;
                  z-index: 1;
                  transition: background 0.5s cubic-bezier(.4,2,.6,1),
                              color 0.3s,
                              border 0.4s,
                              box-shadow 0.6s cubic-bezier(.4,2,.6,1);
                }
                .save-btn-gradient:hover, .save-btn-gradient:focus {
                  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
                  color: #fff;
                  border: 2px solid #a78bfa;
                  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        const li = node.nodeType === 3 ? node.parentElement : node;
        if (li && li.tagName === 'LI' && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                li.remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        console.log('handleIndent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0'); // 2 non-breaking spaces for a visual tab
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { console.log('No parent list'); return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi = li.previousElementSibling;
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            console.log('Indented li into sublist');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No previous sibling, cannot indent first item');
            return;
        }
    }

    function handleOutdent() {
        console.log('handleOutdent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) { console.log('No <li> found'); return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            // Outdent: move li after its parent list
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            console.log('Outdented li to parent list');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No grandparent list, cannot outdent');
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                        img.style.width = img.width + 'px';
                        img.style.height = img.height + 'px';
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';

                // Ensure image is added to wrapper before controls/handle
                wrapper.appendChild(img);

                // Remove wrapper border/background, only border the image
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';

                // Make image interactive (context menu, drag, resize, etc.)
                makeImageInteractive(img, wrapper);

                // Insert at caret
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    range.collapse(false);
                    range.insertNode(wrapper);
                    // Insert a zero-width space after the wrapper if it's at the end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                    // Move caret after image (and zwsp)
                    if (wrapper.nextSibling) {
                        range.setStartAfter(wrapper.nextSibling);
                    } else {
                        range.setStartAfter(wrapper);
                    }
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                } else {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // Update format state on selection and input
    useEffect(() => {
        function updateFormatState() {
            setFormatState({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strike: document.queryCommandState('strikeThrough'),
            });
        }
        document.addEventListener('selectionchange', updateFormatState);
        if (editorRef.current) {
            editorRef.current.addEventListener('input', updateFormatState);
        }
        return () => {
            document.removeEventListener('selectionchange', updateFormatState);
            if (editorRef.current) {
                editorRef.current.removeEventListener('input', updateFormatState);
            }
        };
    }, []);

    // Add this helper before your component's return:
    function makeImageInteractive(img: HTMLImageElement, wrapper: HTMLElement) {
    // --- Context menu logic ---
    img.oncontextmenu = function(e: MouseEvent) {
        e.preventDefault();
        let contextMenu: HTMLDivElement | null = document.querySelector('.docedit-img-contextmenu');
        if (contextMenu) contextMenu.remove();
        contextMenu = document.createElement('div');
        contextMenu.className = 'docedit-img-contextmenu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.background = '#18181b';
        contextMenu.style.border = '2px solid #6366f1';
        contextMenu.style.borderRadius = '0.5rem';
        contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
        contextMenu.style.zIndex = '2147483647';
        contextMenu.style.padding = '0.5em 0';
        contextMenu.style.minWidth = '120px';
        contextMenu.style.color = '#f3f4f6';
        contextMenu.style.fontSize = '1rem';
        contextMenu.style.display = 'flex';
        contextMenu.style.flexDirection = 'column';
        // Delete
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete Image';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = '#f87171';
        delBtn.style.padding = '0.5em 1em';
        delBtn.style.textAlign = 'left';
        delBtn.style.cursor = 'pointer';
        delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
        delBtn.onmouseleave = () => delBtn.style.background = 'none';
        delBtn.onclick = ev => {
            ev.stopPropagation();
            wrapper.remove();
            contextMenu?.remove();
            if (editorRef.current) {
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
            }
        };
        contextMenu.appendChild(delBtn);
        // Float left
        const leftBtn = document.createElement('button');
        leftBtn.textContent = 'Float Left';
        leftBtn.style.background = 'none';
        leftBtn.style.border = 'none';
        leftBtn.style.color = '#a5b4fc';
        leftBtn.style.padding = '0.5em 1em';
        leftBtn.style.textAlign = 'left';
        leftBtn.style.cursor = 'pointer';
        leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
        leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
        leftBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'left';
            img.style.display = 'inline';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(leftBtn);
        // Float right
        const rightBtn = document.createElement('button');
        rightBtn.textContent = 'Float Right';
        rightBtn.style.background = 'none';
        rightBtn.style.border = 'none';
        rightBtn.style.color = '#a5b4fc';
        rightBtn.style.padding = '0.5em 1em';
        rightBtn.style.textAlign = 'left';
        rightBtn.style.cursor = 'pointer';
        rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
        rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
        rightBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'right';
            img.style.display = 'inline';
            img.style.margin = '0.5em 0 0.5em 1em';
            contextMenu?.remove();
        };
        contextMenu.appendChild(rightBtn);
        // Inline
        const inlineBtn = document.createElement('button');
        inlineBtn.textContent = 'Inline';
        inlineBtn.style.background = 'none';
        inlineBtn.style.border = 'none';
        inlineBtn.style.color = '#a5b4fc';
        inlineBtn.style.padding = '0.5em 1em';
        inlineBtn.style.textAlign = 'left';
        inlineBtn.style.cursor = 'pointer';
        inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
        inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
        inlineBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = '';
            img.style.display = 'inline-block';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(inlineBtn);
        // Snap to Grid
        const gridBtn = document.createElement('button');
        gridBtn.textContent = 'Snap to Grid';
        gridBtn.style.background = 'none';
        gridBtn.style.border = 'none';
        gridBtn.style.color = '#a5b4fc';
        gridBtn.style.padding = '0.5em 1em';
        gridBtn.style.textAlign = 'left';
        gridBtn.style.cursor = 'pointer';
        gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
        gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
        gridBtn.onclick = ev => {
            ev.stopPropagation();
            contextMenu?.remove();
            showGridOverlay();
            // Wait for user to click a column
            gridColumns.current.forEach((col, i) => {
                col.style.cursor = 'pointer';
                col.onclick = e => {
                    if (!editorRef.current) return;
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const x = rect.left + i * colWidth + colWidth / 2;
                    let range: Range | null = null;
                    if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(x, rect.top + 10);
                    } else if ((document as any).caretPositionFromPoint) {
                        const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                        }
                    }
                    if (range && editorRef.current.contains(range.startContainer)) {
                        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                        if (range.startContainer.nodeType === 3) {
                            const textNode = range.startContainer as Text;
                            const offset = range.startOffset;
                            const before = textNode.textContent?.slice(0, offset) || '';
                            const after = textNode.textContent?.slice(offset) || '';
                            const parent = textNode.parentNode;
                            if (parent) {
                                if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                parent.insertBefore(wrapper, textNode);
                                if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                            }
                        } else {
                            range.insertNode(wrapper);
                        }
                        // Insert a zero-width space after if at end
                        let zwsp: Text | null = null;
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        const sel = window.getSelection();
                        if (sel) {
                            const r = document.createRange();
                            if (zwsp) {
                                r.setStartAfter(zwsp);
                            } else {
                                r.setStartAfter(wrapper);
                            }
                            r.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(r);
                            if (editorRef.current) editorRef.current.focus();
                        }
                    }
                    hideGridOverlay();
                    gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                };
            });
        };
        contextMenu.appendChild(gridBtn);
        // Untie/Retie
        const untieBtn = document.createElement('button');
        untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
        untieBtn.style.background = 'none';
        untieBtn.style.border = 'none';
        untieBtn.style.color = '#a5b4fc';
        untieBtn.style.padding = '0.5em 1em';
        untieBtn.style.textAlign = 'left';
        untieBtn.style.cursor = 'pointer';
        untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
        untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
        untieBtn.onclick = ev => {
            ev.stopPropagation();
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.setAttribute('data-untied', 'false');
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
                img.style.display = 'block';
            } else {
                wrapper.setAttribute('data-untied', 'true');
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
            }
            contextMenu?.remove();
        };
        contextMenu.appendChild(untieBtn);
        document.body.appendChild(contextMenu);
        const removeMenu = () => {
            contextMenu?.remove();
            contextMenu = null;
            document.removeEventListener('mousedown', onDocClick);
        };
        function onDocClick(ev: MouseEvent) {
            if (contextMenu && !contextMenu.contains(ev.target as Node)) {
                removeMenu();
            }
        }
        setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    };
    // --- Drag logic ---
    img.style.cursor = 'grab';
    let dragging = false, ghost: HTMLImageElement | null = null;
    img.onmousedown = function(e: MouseEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        const isUntied = wrapper.getAttribute('data-untied') === 'true';
        dragging = true;
        img.style.opacity = '0.5';
        ghost = img.cloneNode(true) as HTMLImageElement;
        ghost.style.opacity = '0.7';
        ghost.style.position = 'fixed';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '9999';
        let offsetX = 0, offsetY = 0;
        if (isUntied) {
            offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
            offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
            ghost.style.left = (e.clientX - offsetX) + 'px';
            ghost.style.top = (e.clientY - offsetY) + 'px';
        } else {
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';
        }
        document.body.appendChild(ghost);
        showGridOverlay();
        function onMouseMove(ev: MouseEvent) {
            if (!dragging || !ghost) return;
            if (isUntied) {
                ghost.style.left = (ev.clientX - img.width / 2) + 'px';
                ghost.style.top = (ev.clientY - img.height / 2) + 'px';
            } else {
                ghost.style.left = ev.clientX + 'px';
                ghost.style.top = ev.clientY + 'px';
            }
            // Highlight nearest grid column
            if (editorRef.current && gridColumns.current.length) {
                const rect = editorRef.current.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const colWidth = rect.width / 12;
                const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                gridColumns.current.forEach((col, i) => {
                    col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
                });
            }
        }
        function onMouseUp(ev: MouseEvent) {
            dragging = false;
            img.style.opacity = '1';
            if (ghost) ghost.remove();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            hideGridOverlay();
            if (editorRef.current) {
                const editorRect = editorRef.current.getBoundingClientRect();
                const imgW = img.width;
                const imgH = img.height;
                let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
                let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
                // Clamp to editor bounds
                x = Math.max(0, Math.min(x, editorRect.width - imgW));
                y = Math.max(0, Math.min(y, editorRect.height - imgH));
                if (isUntied) {
                    wrapper.setAttribute('data-untied', 'true');
                    wrapper.style.position = 'absolute';
                    wrapper.style.left = x + 'px';
                    wrapper.style.top = y + 'px';
                    wrapper.style.zIndex = '2147483645';
                    wrapper.style.pointerEvents = 'auto';
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                    editorRef.current.appendChild(wrapper);
                } else {
                    // Find the closest offset in the editor for this column
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                    const col = gridColumns.current[colIdx];
                    if (col) {
                        col.style.cursor = 'pointer';
                        col.onclick = e => {
                            if (!editorRef.current) return;
                            const rect = editorRef.current.getBoundingClientRect();
                            const colWidth = rect.width / 12;
                            const x = rect.left + colIdx * colWidth + colWidth / 2;
                            let range: Range | null = null;
                            if (document.caretRangeFromPoint) {
                                range = document.caretRangeFromPoint(x, rect.top + 10);
                            } else if ((document as any).caretPositionFromPoint) {
                                const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                if (pos) {
                                    range = document.createRange();
                                    range.setStart(pos.offsetNode, pos.offset);
                                    range.collapse(true);
                                }
                            }
                            if (range && editorRef.current.contains(range.startContainer)) {
                                if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                if (range.startContainer.nodeType === 3) {
                                    const textNode = range.startContainer as Text;
                                    const offset = range.startOffset;
                                    const before = textNode.textContent?.slice(0, offset) || '';
                                    const after = textNode.textContent?.slice(offset) || '';
                                    const parent = textNode.parentNode;
                                    if (parent) {
                                        if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                        parent.insertBefore(wrapper, textNode);
                                        if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                        if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                    }
                                } else {
                                    range.insertNode(wrapper);
                                }
                                // Insert a zero-width space after if at end
                                let zwsp: Text | null = null;
                                if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                    zwsp = document.createTextNode('\u200B');
                                    if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                }
                                // Move caret after image (and zwsp)
                                const sel = window.getSelection();
                                if (sel) {
                                    const r = document.createRange();
                                    if (zwsp) {
                                        r.setStartAfter(zwsp);
                                    } else {
                                        r.setStartAfter(wrapper);
                                    }
                                    r.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(r);
                                    if (editorRef.current) editorRef.current.focus();
                                }
                            }
                            hideGridOverlay();
                            gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                        };
                    }
                }
            }
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    // --- Resize handle logic ---
    let cornerHandle = wrapper.querySelector('.docedit-img-resize-corner') as HTMLSpanElement | null;
    if (!cornerHandle) {
        cornerHandle = document.createElement('span');
        cornerHandle.className = 'docedit-img-resize-corner';
        cornerHandle.style.position = 'absolute';
        cornerHandle.style.right = '15px';
        cornerHandle.style.bottom = '6px';
        cornerHandle.style.width = '18px';
        cornerHandle.style.height = '18px';
        cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
        cornerHandle.style.border = '2.5px solid #6366f1';
        cornerHandle.style.borderRadius = '0 0 0.75rem 0';
        cornerHandle.style.cursor = 'nwse-resize';
        cornerHandle.style.zIndex = '10';
        cornerHandle.title = 'Resize (proportional)';
        cornerHandle.style.display = 'none';
        cornerHandle.setAttribute('contenteditable', 'false');
        cornerHandle.style.userSelect = 'none';
        cornerHandle.setAttribute('draggable', 'false');
        cornerHandle.tabIndex = -1;
        wrapper.appendChild(cornerHandle);
    }
    wrapper.onmouseenter = () => { cornerHandle!.style.display = 'block'; };
    wrapper.onmouseleave = () => { cornerHandle!.style.display = 'none'; };
    img.onfocus = () => { cornerHandle!.style.display = 'block'; };
    img.onblur = () => { cornerHandle!.style.display = 'none'; };
    let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
    function setImgSize(w: number, h: number) {
        img.width = w;
        img.height = h;
        img.style.width = w + 'px';
        img.style.height = h + 'px';
    }
    cornerHandle.onmousedown = function(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.width || img.naturalWidth;
        startHeight = img.height || img.naturalHeight;
        aspect = startWidth / startHeight;
        document.body.style.userSelect = 'none';
        function onMouseMove(ev: MouseEvent) {
            if (!resizing) return;
            const dx = ev.clientX - startX;
            let newWidth = Math.max(40, startWidth + dx);
            let newHeight = Math.max(40, newWidth / aspect);
            setImgSize(newWidth, newHeight);
        }
        function onMouseUp() {
            resizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    }

    // Move this to before the return statement so it's in scope for JSX
    function toast(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.innerHTML = `
          <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
          <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
        `;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'rgba(49,46,129,0.98)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 3500);
      }
    }

    // Add a separate toastSave function for the Save button
    function toastSave(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 2000);
      }
     }

    // Add this function inside your component:
    function saveDocument() {
      if (!editorRef.current) return;
      // Clone the editor content to avoid modifying the live DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      // Gather untied images (images not inside a block or grid, or with a special class)
      const images = Array.from(clone.querySelectorAll('img')).map(img => {
        // Get base64 data if possible
        let src = img.src;
        // If the image is a data URL, keep as is; otherwise, try to fetch and convert

        if (!src.startsWith('data:')) {
          // For remote images, skip or fetch as base64 (optional, not implemented here)
        }
        // Collect placement and style info
        return {
          src,
          style: img.getAttribute('style'),
          class: img.getAttribute('class'),
          width: img.width,
          height: img.height,
          alt: img.alt,
          id: img.id,
          parent: img.parentElement?.className || '',
          // Add more attributes as needed
        };
      });
      // Save the HTML (with image srcs as data URLs)
      const html = clone.innerHTML;
      // Bundle into a .havdoc JSON structure
      const doc = {
        type: 'havdoc',
        version: 1,
        html,
        images,
        savedAt: new Date().toISOString()
      };
      // Add magic header
      const magicHeader = 'HAVDOCv1\n';
      const blob = new Blob([
        magicHeader + JSON.stringify(doc, null, 2)
      ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${Date.now()}.havdoc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toastSave('Document saved!');
    }

    // Update rehydrateEditor to run after React renders new HTML
    function rehydrateEditor() {
        if (!editorRef.current) return;
        // For each image, re-apply wrappers and event listeners
        editorRef.current.querySelectorAll('img').forEach(img => {
            let wrapper = img.parentElement;
            // If not already wrapped, wrap it
            if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
                wrapper = document.createElement('span');
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.style.background = 'none';
                img.parentNode?.insertBefore(wrapper, img);
                wrapper.appendChild(img);
            }
            // Restore tied/untied state
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
                // Restore left/top if present
                if (wrapper.style.left) wrapper.style.left = wrapper.style.left;
                if (wrapper.style.top) wrapper.style.top = wrapper.style.top;
            } else {
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
            }
            // Add handle if not present
            if (!wrapper.querySelector('.docedit-img-resize-corner')) {
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px';
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;
                wrapper.appendChild(cornerHandle);
            }
            // Make image interactive (context menu, drag, resize, etc.)
            makeImageInteractive(img, wrapper);
        });
    }

    // Add this function so onInput={handleEditorInput} works
    function handleEditorInput() {
        checkEmpty();
    }

    // Add this function before the return statement:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          const doc = JSON.parse(text);
          if (doc && typeof doc.html === 'string') {
            if (editorRef.current) {
              editorRef.current.innerHTML = doc.html;
              setEditorHtml(doc.html); // for saving later
              setTimeout(() => {
                rehydrateEditor();
                checkEmpty();
                toastSave('Document loaded!');
              }, 0);
            }
          }
        } catch (err) {
          toast('Failed to load document.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    // Render the editor and toolbar
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
                    {/* Gradient outline wrapper */}
                    <div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
                        <div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
                            {/* Toolbar ...existing code... */}
                            <div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
                                <div className="flex gap-1 items-center">
                                    <button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
                                        <span className="material-symbols-outlined">undo</span>
                                    </button>
                                    <button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
                                        <span className="material-symbols-outlined">redo</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <select
                                        className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
                                        value={blockType}
                                        onChange={e => {
                                            setBlockType(e.target.value);
                                            runCommand('formatBlock', e.target.value);
                                        }}
                                        title="Block type"
                                    >
                                        {BLOCK_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
                                        <span className="material-symbols-outlined">format_list_bulleted</span>
                                    </button>
                                    <button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </button>
                                    <button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
                                        <span className="material-symbols-outlined">format_indent_decrease</span>
                                    </button>
                                    <button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
                                        <span className="material-symbols-outlined">format_indent_increase</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
                                        <span className="material-symbols-outlined">link</span>
                                    </button>
                                    <button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
                                        <span className="material-symbols-outlined">link_off</span>
                                    </button>
                                </div>
                                {/* Save & Extras group at far right */}
                                <div className="flex gap-2 ml-auto items-center">
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Load
                                    </button>
                                    <input
                                        type="file"
                                        accept=".havdoc"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleLoadDocument}
                                    />
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={saveDocument}
                                    >
                                        Save
                                    </button>
                                    <div className="relative">
                                        <button
                                            ref={extrasBtnRef}
                                            type="button"
                                            className="toolbar-btn toolbar-icon"
                                            title="Extras"
                                            onClick={() => setShowExtras(e => !e)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                        {showExtras && createPortal(
                                            (() => {
                                                if (!extrasBtnRef.current) return null;
                                                const rect = extrasBtnRef.current.getBoundingClientRect();
                                                return (
                                                    <div
                                                        className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999]"
                                                        style={{
                                                            top: rect.bottom + 4 + window.scrollY,
                                                            left: rect.right - 224 + window.scrollX, // 224px = menu width
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <b>B</b>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <i>I</i>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <u>U</u>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                                                                            <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <s>S</s>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item"
                                                            onClick={() => {
                                                                setShowExtras(false);
                                                                setTimeout(() => imageInputRef.current?.click(), 100);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined align-middle mr-2">image</span>
                                                            Insert Image
                                                        </button>
                                                    </div>
                                                );
                                            })(),
                                            document.body
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleImageInsert}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Editor area and placeholder wrapper */}
                            <div style={{position: 'relative', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                                <div
                                    ref={editorRef}
                                    className="flex-1 flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
                                    contentEditable
                                    suppressContentEditableWarning
                                    spellCheck={true}
                                    aria-label="Document editor"
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onInput={handleEditorInput}
                                    style={{flex:1, minHeight:'0'}}
                                    onKeyDown={e => {
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            if (e.shiftKey) {
                                                handleOutdent();
                                            } else {
                                                handleIndent();
                                            }
                                        }
                                        handleEditorKeyDown(e);
                                    }}
                                />
                                {/* Overlay placeholder, absolutely positioned over the editor area */}
                                {isEmpty && !isFocused && (
                                    <span className="editor-placeholder" style={{
                                        position: 'absolute',
                                        left: '2.5rem',
                                        top: '2.5rem',
                                        zIndex: 10,
                                        userSelect: 'none',
                                        pointerEvents: 'none',
                                        color: '#9ca3af',
                                        fontSize: '1rem',
                                        transition: 'opacity 0.15s'
                                    }}>
                                        Start your document...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Loader overlay and fade-in logic remain unchanged */}
            {showLoader && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
                    <span className="loader" aria-label="Loading" />
                </div>
            )}
        </div>
    );
}





// FULL FUNCTION



"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BLOCK_TYPES = [
    { label: "Paragraph", value: "P" },
    { label: "Heading 1", value: "H1" },
    { label: "Heading 2", value: "H2" },
    { label: "Heading 3", value: "H3" },
    { label: "Blockquote", value: "BLOCKQUOTE" },
    { label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
    const editorRef = useRef<HTMLDivElement>(null);
    const gridOverlay = useRef<HTMLDivElement | null>(null);
    const gridColumns = useRef<HTMLDivElement[]>([]);
    const [blockType, setBlockType] = useState("P");
    const [isEmpty, setIsEmpty] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [showExtras, setShowExtras] = useState(false);
    const [extrasMenuPos, setExtrasMenuPos] = useState<{top:number,left:number,width:number}|null>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const extrasBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
    const [editorHtml, setEditorHtml] = useState<string>(""); // keep for save/load, not for rendering
    let gridOverlayEl: HTMLDivElement | null = null;
    let gridColumnsEl: HTMLDivElement[] = [];

    useEffect(() => {
        setMounted(true);
        // Fade in editor after a short delay for smoothness
        const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
        // Fade out loader after editor is visible
        const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
        return () => {
            clearTimeout(fadeInTimeout);
            clearTimeout(loaderTimeout);
        };
    }, []);

    // --- GRID OVERLAY SHOW/HIDE HELPERS ---
    function showGridOverlay() {
        ensureGridOverlay();
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'flex';
            gridOverlay.current.style.pointerEvents = 'auto';
            gridOverlay.current.style.zIndex = '99999';
        }
    }
    function hideGridOverlay() {
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'none';
        }
    }

    // Helper to focus editor and run command
    // Update format state immediately after running a command
    const runCommand = (command: string, value?: any) => {
        if (editorRef.current) {
            editorRef.current.focus();
            setTimeout(() => {
                if (value !== undefined) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command);
                }
                detectBlockType();
                checkEmpty();
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                });
                // --- Use zero-width non-breaking space for bold/strike toggle ---
                if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
                        let node = sel.anchorNode;
                        if (node && node.nodeType === 3 && node.parentElement) {
                            let parent = node.parentElement;
                            const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
                            const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
                            if (isBold || isStrike) {
                                const offset = sel.anchorOffset;
                                const text = node.textContent || '';
                                // Split the text node at the caret
                                const before = text.slice(0, offset);
                                const after = text.slice(offset);
                                node.textContent = before;
                                // Insert a zero-width non-breaking space after the formatting node
                                const zwsp = document.createTextNode('\uFEFF');
                                if (parent.nextSibling) {
                                    parent.parentNode.insertBefore(zwsp, parent.nextSibling);
                                } else {
                                    parent.parentNode.appendChild(zwsp);
                                }
                                // Move caret to the zwsp
                                const range = document.createRange();
                                range.setStart(zwsp, 1);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Remove the zwsp on next input
                                const cleanup = () => {
                                    if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
                                    editorRef.current?.removeEventListener('input', cleanup);
                                };
                                editorRef.current.addEventListener('input', cleanup);
                                // Optionally, also clean up on paste
                                editorRef.current.addEventListener('paste', cleanup, { once: true });
                            }
                        }
                    }
                }
            }, 0);
        }
    };

    // Helper for link creation with selection restore
    const handleLink = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        // Save selection
        const savedRange = range.cloneRange();
        const url = prompt("Enter URL:");
        if (url) {
            editorRef.current.focus();
            // Restore selection
            selection.removeAllRanges();
            selection.addRange(savedRange);
            setTimeout(() => {
                document.execCommand("createLink", false, url);
            }, 0);
        }
    };

    // Detect block type on selection change
    const detectBlockType = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.anchorNode as HTMLElement | null;
        if (node && node.nodeType === 3) node = node.parentElement;
        while (node && node !== editorRef.current) {
            const tag = node.tagName;
            if (
                tag === "H1" ||
                tag === "H2" ||
                tag === "H3" ||
                tag === "BLOCKQUOTE" ||
                tag === "PRE" ||
                tag === "P"
            ) {
                setBlockType(tag);
                return;
            }
            node = node.parentElement;
        }
        setBlockType("P");
    };

    // Check if editor is empty
    const checkEmpty = () => {
        let text = "";
        if (editorRef.current) {
            text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
        } else if (editorHtml) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = editorHtml;
            text = tempDiv.innerText.replace(/\n|\r/g, "").trim();
        }
        setIsEmpty(text === "");
    };

    useEffect(() => {
        document.addEventListener("selectionchange", detectBlockType);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", checkEmpty);
            editorRef.current.addEventListener("blur", checkEmpty);
        }
        return () => {
            document.removeEventListener("selectionchange", detectBlockType);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", checkEmpty);
                editorRef.current.removeEventListener("blur", checkEmpty);
            }
        };
    }, []);

    // --- GRID OVERLAY DYNAMIC LINES ---
    function updateGridOverlayLines() {
        if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
        const editor = editorRef.current;
        const style = window.getComputedStyle(editor);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) lineHeight = 28; // fallback
        const editorHeight = editor.offsetHeight;
        const numRows = Math.floor(editorHeight / lineHeight);
        // Remove old horizontal lines
        [...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
        // Add horizontal lines
        for (let r = 1; r < numRows; r++) {
            const hline = document.createElement('div');
            hline.className = 'docedit-grid-hline';
            hline.style.position = 'absolute';
            hline.style.left = '0';
            hline.style.right = '0';
            hline.style.top = (r * lineHeight) + 'px';
            hline.style.height = '0';
            hline.style.borderTop = '1px dashed #818cf8';
            hline.style.pointerEvents = 'none';
            gridOverlay.current.appendChild(hline);
        }
        // Remove old rows from columns
        gridColumns.current.forEach((col) => {
            [...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
        });
    }

    function ensureGridOverlay() {
        if (!editorRef.current) return;
        if (!gridOverlay.current) {
            const overlay = document.createElement('div');
            overlay.className = 'docedit-grid-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'row';
            overlay.style.gap = '0';
            gridColumns.current = [];
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.style.flex = '1 1 0';
                col.style.height = '100%';
                col.style.background = 'none';
                col.className = 'docedit-grid-col';
                overlay.appendChild(col);
                gridColumns.current.push(col);
            }
            editorRef.current.appendChild(overlay);
            gridOverlay.current = overlay;
        }
        gridOverlay.current.style.display = 'flex';
        gridOverlay.current.style.pointerEvents = 'auto';
        gridOverlay.current.style.zIndex = '99999';
    }

    // Inject styles only on client
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const styleId = 'docedit-blockstyle';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
              .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
              .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
              .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
              .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
              .document-editor p { margin: 0.5em 0; }
              .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
              .document-editor ul { list-style-type: disc; }
              .document-editor ol { list-style-type: decimal; }
              .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
              .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
            `;
            document.head.appendChild(style);
        }
        // Toolbar styles
        const toolbarStyleId = 'docedit-toolbar-style';
        if (!document.getElementById(toolbarStyleId)) {
            const style = document.createElement('style');
            style.id = toolbarStyleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                .editor-toolbar {
                    background: #18181b;
                    box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
                    border-bottom: 2px solid #52525b;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                    min-height: 3.5rem;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                }
                .toolbar-btn {
                    padding: 0.35rem 0.7rem;
                    border-radius: 0.375rem;
                    background: #27272a;
                    color: #f3f4f6;
                    font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    margin-right: 0.15rem;
                    margin-bottom: 0.1rem;
                    min-width: 1.7rem;
                    min-height: 1.7rem;
                    line-height: 1.2;
                    font-size: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    cursor: pointer;
                }
                .toolbar-btn:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn:hover {
                    background: #3f3f46;
                    color: #a5b4fc;
                }
                .toolbar-btn:active {
                    background: #52525b;
                    color: #f3f4f6;
                }
                .toolbar-icon .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined', sans-serif;
                    font-size: 1.35rem;
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    vertical-align: middle;
                    margin: 0;
                }
                .toolbar-dropdown {
                    min-width: 8rem;
                    font-size: 1.05rem;
                    font-weight: 600;
                    background: #18181b;
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    padding: 0.3rem 0.7rem;
                    border-radius: 0.375rem;
                }
                .toolbar-dropdown:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn.menu-item {
                  border: 1.5px solid transparent;
                  transition: border 0.15s, background 0.15s, color 0.15s;
                }
                .toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
                  border: 1.5px solid #818cf8;
                  background: #3f3f46;
                  color: #a5b4fc;
                }
                .toolbar-btn.active {
                  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
                  color: #fff;
                  border: 2px solid #a5b4fc;
                  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
                  text-shadow: 0 0 4px #818cf8;
                }
            `;
            document.head.appendChild(style);
        }
        // Gradient outline styles
        const gradientStyleId = 'docedit-gradient-outline-style';
        if (!document.getElementById(gradientStyleId)) {
            const style = document.createElement('style');
            style.id = gradientStyleId;
            style.innerHTML = `
    .gradient-outline {
      position: relative;
      border-radius: 0.75rem;
      z-index: 1;
      padding: 3px;
      background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
      transition: box-shadow 0.2s;
    }
    .gradient-outline:focus-within, .gradient-outline:hover {
      box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
    }
    `;
            document.head.appendChild(style);
        }
        // Grid overlay styles
        const gridStyleId = 'docedit-grid-style';
        if (!document.getElementById(gridStyleId)) {
            const style = document.createElement('style');
            style.id = gridStyleId;
            style.innerHTML = `
                .docedit-grid-overlay {
                    pointer-events: auto;
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 99999;
                    display: flex;
                    flex-direction: row;
                    gap: 0;
                }
                .docedit-grid-col {
                    flex: 1 1 0;
                    height: 100%;
                    background: rgba(129,140,248,0.18); /* Indigo-400, semi-transparent */
                    border-left: 1px solid #6366f1;
                    border-right: 1px solid #6366f1;
                    position: relative;
                    transition: background 0.12s;
                }
                .docedit-grid-col:hover {
                    background: rgba(129,140,248,0.35);
                }
                .docedit-grid-row {
                    position: absolute;
                    left: 0; right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
                .docedit-grid-hline {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Save button gradient hover effect
        const saveBtnStyleId = 'docedit-save-btn-gradient-style';
        if (!document.getElementById(saveBtnStyleId)) {
            const style = document.createElement('style');
            style.id = saveBtnStyleId;
            style.innerHTML = `
                .save-btn-gradient {
                  background: #18181b;
                  border: 2px solid transparent;
                  box-shadow: none;
                  position: relative;
                  z-index: 1;
                  transition: background 0.5s cubic-bezier(.4,2,.6,1),
                              color 0.3s,
                              border 0.4s,
                              box-shadow 0.6s cubic-bezier(.4,2,.6,1);
                }
                .save-btn-gradient:hover, .save-btn-gradient:focus {
                  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
                  color: #fff;
                  border: 2px solid #a78bfa;
                  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        const li = node.nodeType === 3 ? node.parentElement : node;
        if (li && li.tagName === 'LI' && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                li.remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        console.log('handleIndent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0'); // 2 non-breaking spaces for a visual tab
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { console.log('No parent list'); return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi = li.previousElementSibling;
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            console.log('Indented li into sublist');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No previous sibling, cannot indent first item');
            return;
        }
    }

    function handleOutdent() {
        console.log('handleOutdent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) { console.log('No <li> found'); return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            // Outdent: move li after its parent list
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            console.log('Outdented li to parent list');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No grandparent list, cannot outdent');
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                        img.style.width = img.width + 'px';
                        img.style.height = img.height + 'px';
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';
                wrapper.appendChild(img);
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';
                makeImageInteractive(img, wrapper);

                // Only insert if selection is inside the editor, otherwise append to editor
                let inserted = false;
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    let node = sel.anchorNode;
                    let insideEditor = false;
                    while (node) {
                        if (node === editorRef.current) { insideEditor = true; break; }
                        node = node.parentNode;
                    }
                    if (insideEditor) {
                        range.collapse(false);
                        range.insertNode(wrapper);
                        // Insert a zero-width space after the wrapper if it's at the end
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            const zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        if (wrapper.nextSibling) {
                            range.setStartAfter(wrapper.nextSibling);
                        } else {
                            range.setStartAfter(wrapper);
                        }
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        inserted = true;
                    }
                }
                if (!inserted) {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // Update format state on selection and input
    useEffect(() => {
        function updateFormatState() {
            setFormatState({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strike: document.queryCommandState('strikeThrough'),
            });
        }
        document.addEventListener('selectionchange', updateFormatState);
        if (editorRef.current) {
            editorRef.current.addEventListener('input', updateFormatState);
        }
        return () => {
            document.removeEventListener('selectionchange', updateFormatState);
            if (editorRef.current) {
                editorRef.current.removeEventListener('input', updateFormatState);
            }
        };
    }, []);

    // Add this helper before your component's return:
    function makeImageInteractive(img: HTMLImageElement, wrapper: HTMLElement) {
    // --- Context menu logic ---
    img.oncontextmenu = function(e: MouseEvent) {
        e.preventDefault();
        let contextMenu: HTMLDivElement | null = document.querySelector('.docedit-img-contextmenu');
        if (contextMenu) contextMenu.remove();
        contextMenu = document.createElement('div');
        contextMenu.className = 'docedit-img-contextmenu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.background = '#18181b';
        contextMenu.style.border = '2px solid #6366f1';
        contextMenu.style.borderRadius = '0.5rem';
        contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
        contextMenu.style.zIndex = '2147483647';
        contextMenu.style.padding = '0.5em 0';
        contextMenu.style.minWidth = '120px';
        contextMenu.style.color = '#f3f4f6';
        contextMenu.style.fontSize = '1rem';
        contextMenu.style.display = 'flex';
        contextMenu.style.flexDirection = 'column';
        // Delete
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete Image';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = '#f87171';
        delBtn.style.padding = '0.5em 1em';
        delBtn.style.textAlign = 'left';
        delBtn.style.cursor = 'pointer';
        delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
        delBtn.onmouseleave = () => delBtn.style.background = 'none';
        delBtn.onclick = ev => {
            ev.stopPropagation();
            wrapper.remove();
            contextMenu?.remove();
            if (editorRef.current) {
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
            }
        };
        contextMenu.appendChild(delBtn);
        // Float left
        const leftBtn = document.createElement('button');
        leftBtn.textContent = 'Float Left';
        leftBtn.style.background = 'none';
        leftBtn.style.border = 'none';
        leftBtn.style.color = '#a5b4fc';
        leftBtn.style.padding = '0.5em 1em';
        leftBtn.style.textAlign = 'left';
        leftBtn.style.cursor = 'pointer';
        leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
        leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
        leftBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'left';
            img.style.display = 'inline';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(leftBtn);
        // Float right
        const rightBtn = document.createElement('button');
        rightBtn.textContent = 'Float Right';
        rightBtn.style.background = 'none';
        rightBtn.style.border = 'none';
        rightBtn.style.color = '#a5b4fc';
        rightBtn.style.padding = '0.5em 1em';
        rightBtn.style.textAlign = 'left';
        rightBtn.style.cursor = 'pointer';
        rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
        rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
        rightBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'right';
            img.style.display = 'inline';
            img.style.margin = '0.5em 0 0.5em 1em';
            contextMenu?.remove();
        };
        contextMenu.appendChild(rightBtn);
        // Inline
        const inlineBtn = document.createElement('button');
        inlineBtn.textContent = 'Inline';
        inlineBtn.style.background = 'none';
        inlineBtn.style.border = 'none';
        inlineBtn.style.color = '#a5b4fc';
        inlineBtn.style.padding = '0.5em 1em';
        inlineBtn.style.textAlign = 'left';
        inlineBtn.style.cursor = 'pointer';
        inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
        inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
        inlineBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = '';
            img.style.display = 'inline-block';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(inlineBtn);
        // Snap to Grid
        const gridBtn = document.createElement('button');
        gridBtn.textContent = 'Snap to Grid';
        gridBtn.style.background = 'none';
        gridBtn.style.border = 'none';
        gridBtn.style.color = '#a5b4fc';
        gridBtn.style.padding = '0.5em 1em';
        gridBtn.style.textAlign = 'left';
        gridBtn.style.cursor = 'pointer';
        gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
        gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
        gridBtn.onclick = ev => {
            ev.stopPropagation();
            contextMenu?.remove();
            showGridOverlay();
            // Wait for user to click a column
            gridColumns.current.forEach((col, i) => {
                col.style.cursor = 'pointer';
                col.onclick = e => {
                    if (!editorRef.current) return;
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const x = rect.left + i * colWidth + colWidth / 2;
                    let range: Range | null = null;
                    if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(x, rect.top + 10);
                    } else if ((document as any).caretPositionFromPoint) {
                        const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                        }
                    }
                    if (range && editorRef.current.contains(range.startContainer)) {
                        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                        if (range.startContainer.nodeType === 3) {
                            const textNode = range.startContainer as Text;
                            const offset = range.startOffset;
                            const before = textNode.textContent?.slice(0, offset) || '';
                            const after = textNode.textContent?.slice(offset) || '';
                            const parent = textNode.parentNode;
                            if (parent) {
                                if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                parent.insertBefore(wrapper, textNode);
                                if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                            }
                        } else {
                            range.insertNode(wrapper);
                        }
                        // Insert a zero-width space after if at end
                        let zwsp: Text | null = null;
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        const sel = window.getSelection();
                        if (sel) {
                            const r = document.createRange();
                            if (zwsp) {
                                r.setStartAfter(zwsp);
                            } else {
                                r.setStartAfter(wrapper);
                            }
                            r.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(r);
                            if (editorRef.current) editorRef.current.focus();
                        }
                    }
                    hideGridOverlay();
                    gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                };
            });
        };
        contextMenu.appendChild(gridBtn);
        // Untie/Retie
        const untieBtn = document.createElement('button');
        untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
        untieBtn.style.background = 'none';
        untieBtn.style.border = 'none';
        untieBtn.style.color = '#a5b4fc';
        untieBtn.style.padding = '0.5em 1em';
        untieBtn.style.textAlign = 'left';
        untieBtn.style.cursor = 'pointer';
        untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
        untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
        untieBtn.onclick = ev => {
            ev.stopPropagation();
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.setAttribute('data-untied', 'false');
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
                img.style.display = 'block';
            } else {
                wrapper.setAttribute('data-untied', 'true');
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
            }
            contextMenu?.remove();
        };
        contextMenu.appendChild(untieBtn);
        document.body.appendChild(contextMenu);
        const removeMenu = () => {
            contextMenu?.remove();
            contextMenu = null;
            document.removeEventListener('mousedown', onDocClick);
        };
        function onDocClick(ev: MouseEvent) {
            if (contextMenu && !contextMenu.contains(ev.target as Node)) {
                removeMenu();
            }
        }
        setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    };
    // --- Drag logic ---
    img.style.cursor = 'grab';
    let dragging = false, ghost: HTMLImageElement | null = null;
    img.onmousedown = function(e: MouseEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        const isUntied = wrapper.getAttribute('data-untied') === 'true';
        dragging = true;
        img.style.opacity = '0.5';
        ghost = img.cloneNode(true) as HTMLImageElement;
        ghost.style.opacity = '0.7';
        ghost.style.position = 'fixed';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '9999';
        let offsetX = 0, offsetY = 0;
        if (isUntied) {
            offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
            offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
            ghost.style.left = (e.clientX - offsetX) + 'px';
            ghost.style.top = (e.clientY - offsetY) + 'px';
        } else {
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';
        }
        document.body.appendChild(ghost);
        showGridOverlay();
        function onMouseMove(ev: MouseEvent) {
            if (!dragging || !ghost) return;
            if (isUntied) {
                ghost.style.left = (ev.clientX - img.width / 2) + 'px';
                ghost.style.top = (ev.clientY - img.height / 2) + 'px';
            } else {
                ghost.style.left = ev.clientX + 'px';
                ghost.style.top = ev.clientY + 'px';
            }
            // Highlight nearest grid column
            if (editorRef.current && gridColumns.current.length) {
                const rect = editorRef.current.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const colWidth = rect.width / 12;
                const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                gridColumns.current.forEach((col, i) => {
                    col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
                });
            }
        }
        function onMouseUp(ev: MouseEvent) {
            dragging = false;
            img.style.opacity = '1';
            if (ghost) ghost.remove();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            hideGridOverlay();
            if (editorRef.current) {
                const editorRect = editorRef.current.getBoundingClientRect();
                const imgW = img.width;
                const imgH = img.height;
                let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
                let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
                // Clamp to editor bounds
                x = Math.max(0, Math.min(x, editorRect.width - imgW));
                y = Math.max(0, Math.min(y, editorRect.height - imgH));
                if (isUntied) {
                    wrapper.setAttribute('data-untied', 'true');
                    wrapper.style.position = 'absolute';
                    wrapper.style.left = x + 'px';
                    wrapper.style.top = y + 'px';
                    wrapper.style.zIndex = '2147483645';
                    wrapper.style.pointerEvents = 'auto';
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                    editorRef.current.appendChild(wrapper);
                } else {
                    // Find the closest offset in the editor for this column
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                    const col = gridColumns.current[colIdx];
                    if (col) {
                        col.style.cursor = 'pointer';
                        col.onclick = e => {
                            if (!editorRef.current) return;
                            const rect = editorRef.current.getBoundingClientRect();
                            const colWidth = rect.width / 12;
                            const x = rect.left + colIdx * colWidth + colWidth / 2;
                            let range: Range | null = null;
                            if (document.caretRangeFromPoint) {
                                range = document.caretRangeFromPoint(x, rect.top + 10);
                            } else if ((document as any).caretPositionFromPoint) {
                                const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                if (pos) {
                                    range = document.createRange();
                                    range.setStart(pos.offsetNode, pos.offset);
                                    range.collapse(true);
                                }
                            }
                            if (range && editorRef.current.contains(range.startContainer)) {
                                if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                if (range.startContainer.nodeType === 3) {
                                    const textNode = range.startContainer as Text;
                                    const offset = range.startOffset;
                                    const before = textNode.textContent?.slice(0, offset) || '';
                                    const after = textNode.textContent?.slice(offset) || '';
                                    const parent = textNode.parentNode;
                                    if (parent) {
                                        if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                        parent.insertBefore(wrapper, textNode);
                                        if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                        if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                    }
                                } else {
                                    range.insertNode(wrapper);
                                }
                                // Insert a zero-width space after if at end
                                let zwsp: Text | null = null;
                                if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                    zwsp = document.createTextNode('\u200B');
                                    if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                }
                                // Move caret after image (and zwsp)
                                const sel = window.getSelection();
                                if (sel) {
                                    const r = document.createRange();
                                    if (zwsp) {
                                        r.setStartAfter(zwsp);
                                    } else {
                                        r.setStartAfter(wrapper);
                                    }
                                    r.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(r);
                                    if (editorRef.current) editorRef.current.focus();
                                }
                            }
                            hideGridOverlay();
                            gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                        };
                    }
                }
            }
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    // --- Resize handle logic ---
    let cornerHandle = wrapper.querySelector('.docedit-img-resize-corner') as HTMLSpanElement | null;
    if (!cornerHandle) {
        cornerHandle = document.createElement('span');
        cornerHandle.className = 'docedit-img-resize-corner';
        cornerHandle.style.position = 'absolute';
        cornerHandle.style.right = '15px';
        cornerHandle.style.bottom = '6px';
        cornerHandle.style.width = '18px';
        cornerHandle.style.height = '18px';
        cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
        cornerHandle.style.border = '2.5px solid #6366f1';
        cornerHandle.style.borderRadius = '0 0 0.75rem 0';
        cornerHandle.style.cursor = 'nwse-resize';
        cornerHandle.style.zIndex = '10';
        cornerHandle.title = 'Resize (proportional)';
        cornerHandle.style.display = 'none';
        cornerHandle.setAttribute('contenteditable', 'false');
        cornerHandle.style.userSelect = 'none';
        cornerHandle.setAttribute('draggable', 'false');
        cornerHandle.tabIndex = -1;
        wrapper.appendChild(cornerHandle);
    }
    wrapper.onmouseenter = () => { cornerHandle!.style.display = 'block'; };
    wrapper.onmouseleave = () => { cornerHandle!.style.display = 'none'; };
    img.onfocus = () => { cornerHandle!.style.display = 'block'; };
    img.onblur = () => { cornerHandle!.style.display = 'none'; };
    let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
    function setImgSize(w: number, h: number) {
        img.width = w;
        img.height = h;
        img.style.width = w + 'px';
        img.style.height = h + 'px';
    }
    cornerHandle.onmousedown = function(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.width || img.naturalWidth;
        startHeight = img.height || img.naturalHeight;
        aspect = startWidth / startHeight;
        document.body.style.userSelect = 'none';
        function onMouseMove(ev: MouseEvent) {
            if (!resizing) return;
            const dx = ev.clientX - startX;
            let newWidth = Math.max(40, startWidth + dx);
            let newHeight = Math.max(40, newWidth / aspect);
            setImgSize(newWidth, newHeight);
        }
        function onMouseUp() {
            resizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    }

    // Move this to before the return statement so it's in scope for JSX
    function toast(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.innerHTML = `
          <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
          <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
        `;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'rgba(49,46,129,0.98)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 3500);
      }
    }

    // Add a separate toastSave function for the Save button
    function toastSave(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 2000);
      }
     }

    // Add this function inside your component:
    function saveDocument() {
      if (!editorRef.current) return;
      // Clone the editor content to avoid modifying the live DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      // Gather untied images (images not inside a block or grid, or with a special class)
      const images = Array.from(clone.querySelectorAll('img')).map(img => {
        // Get base64 data if possible
        let src = img.src;
        // If the image is a data URL, keep as is; otherwise, try to fetch and convert

        if (!src.startsWith('data:')) {
          // For remote images, skip or fetch as base64 (optional, not implemented here)
        }
        // Collect placement and style info
        return {
          src,
          style: img.getAttribute('style'),
          class: img.getAttribute('class'),
          width: img.width,
          height: img.height,
          alt: img.alt,
          id: img.id,
          parent: img.parentElement?.className || '',
          // Add more attributes as needed
        };
      });
      // Save the HTML (with image srcs as data URLs)
      const html = clone.innerHTML;
      // Bundle into a .havdoc JSON structure
      const doc = {
        type: 'havdoc',
        version: 1,
        html,
        images,
        savedAt: new Date().toISOString()
      };
      // Add magic header
      const magicHeader = 'HAVDOCv1\n';
      const blob = new Blob([
        magicHeader + JSON.stringify(doc, null, 2)
      ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${Date.now()}.havdoc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toastSave('Document saved!');
    }

    // Update rehydrateEditor to run after React renders new HTML
    function rehydrateEditor() {
        if (!editorRef.current) return;
        // For each image, re-apply wrappers and event listeners
        editorRef.current.querySelectorAll('img').forEach(img => {
            let wrapper = img.parentElement;
            // If not already wrapped, wrap it
            if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
                wrapper = document.createElement('span');
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.style.background = 'none';
                img.parentNode?.insertBefore(wrapper, img);
                wrapper.appendChild(img);
            }
            // Restore tied/untied state
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
                // Restore left/top if present
                if (wrapper.style.left) wrapper.style.left = wrapper.style.left;
                if (wrapper.style.top) wrapper.style.top = wrapper.style.top;
            } else {
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
            }
            // Add handle if not present
            if (!wrapper.querySelector('.docedit-img-resize-corner')) {
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px';
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;
                wrapper.appendChild(cornerHandle);
            }
            // Make image interactive (context menu, drag, resize, etc.)
            makeImageInteractive(img, wrapper);
        });
    }

    // Add this function so onInput={handleEditorInput} works
    function handleEditorInput() {
        checkEmpty();
    }

    // Add this function before the return statement:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          const doc = JSON.parse(text);
          if (doc && typeof doc.html === 'string') {
            if (editorRef.current) {
              editorRef.current.innerHTML = doc.html;
              setEditorHtml(doc.html); // for saving later
              setTimeout(() => {
                rehydrateEditor();
                checkEmpty();
                toastSave('Document loaded!');
              }, 0);
            }
          }
        } catch (err) {
          toast('Failed to load document.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    // Render the editor and toolbar
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
                    {/* Gradient outline wrapper */}
                    <div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
                        <div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
                            {/* Toolbar ...existing code... */}
                            <div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
                                <div className="flex gap-1 items-center">
                                    <button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
                                        <span className="material-symbols-outlined">undo</span>
                                    </button>
                                    <button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
                                        <span className="material-symbols-outlined">redo</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <select
                                        className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
                                        value={blockType}
                                        onChange={e => {
                                            setBlockType(e.target.value);
                                            runCommand('formatBlock', e.target.value);
                                        }}
                                        title="Block type"
                                    >
                                        {BLOCK_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
                                        <span className="material-symbols-outlined">format_list_bulleted</span>
                                    </button>
                                    <button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </button>
                                    <button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
                                        <span className="material-symbols-outlined">format_indent_decrease</span>
                                    </button>
                                    <button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
                                        <span className="material-symbols-outlined">format_indent_increase</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
                                        <span className="material-symbols-outlined">link</span>
                                    </button>
                                    <button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
                                        <span className="material-symbols-outlined">link_off</span>
                                    </button>
                                </div>
                                {/* Save & Extras group at far right */}
                                <div className="flex gap-2 ml-auto items-center">
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Load
                                    </button>
                                    <input
                                        type="file"
                                        accept=".havdoc"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleLoadDocument}
                                    />
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={saveDocument}
                                    >
                                        Save
                                    </button>
                                    <div className="relative">
                                        <button
                                            ref={extrasBtnRef}
                                            type="button"
                                            className="toolbar-btn toolbar-icon"
                                            title="Extras"
                                            onClick={() => setShowExtras(e => !e)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                        {showExtras && createPortal(
                                            (() => {
                                                if (!extrasBtnRef.current) return null;
                                                const rect = extrasBtnRef.current.getBoundingClientRect();
                                                return (
                                                    <div
                                                        className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999]"
                                                        style={{
                                                            top: rect.bottom + 4 + window.scrollY,
                                                            left: rect.right - 224 + window.scrollX, // 224px = menu width
                                                        }}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <b>B</b>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <i>I</i>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <u>U</u>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                                                                            <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                            onClick={() => toast('coming soon')}
                                                        >
                                                            <s>S</s>
                                                            <span className="text-xs ml-2">(Coming Soon)</span>
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="w-full text-left px-4 py-2 toolbar-btn menu-item"
                                                            onClick={() => {
                                                                setShowExtras(false);
                                                                setTimeout(() => imageInputRef.current?.click(), 100);
                                                            }}
                                                        >
                                                            <span className="material-symbols-outlined align-middle mr-2">image</span>
                                                            Insert Image
                                                        </button>
                                                    </div>
                                                );
                                            })(),
                                            document.body
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleImageInsert}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Editor area and placeholder wrapper */}
                            <div style={{position: 'relative', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                                <div
                                    ref={editorRef}
                                    className="flex-1 flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
                                    contentEditable
                                    suppressContentEditableWarning
                                    spellCheck={true}
                                    aria-label="Document editor"
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onInput={handleEditorInput}
                                    style={{flex:1, minHeight:'0'}}
                                    onKeyDown={e => {
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            if (e.shiftKey) {
                                                handleOutdent();
                                            } else {
                                                handleIndent();
                                            }
                                        }
                                        handleEditorKeyDown(e);
                                    }}
                                />
                                {/* Overlay placeholder, absolutely positioned over the editor area */}
                                {isEmpty && !isFocused && (
                                    <span className="editor-placeholder" style={{
                                        position: 'absolute',
                                        left: '2.5rem',
                                        top: '2.5rem',
                                        zIndex: 10,
                                        userSelect: 'none',
                                        pointerEvents: 'none',
                                        color: '#9ca3af',
                                        fontSize: '1rem',
                                        transition: 'opacity 0.15s'
                                    }}>
                                        Start your document...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Loader overlay and fade-in logic remain unchanged */}
            {showLoader && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
                    <span className="loader" aria-label="Loading" />
                </div>
            )}
        </div>
    );
}



///EVERYTHING WORKS WELL


"use client";

import { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

const BLOCK_TYPES = [
    { label: "Paragraph", value: "P" },
    { label: "Heading 1", value: "H1" },
    { label: "Heading 2", value: "H2" },
    { label: "Heading 3", value: "H3" },
    { label: "Blockquote", value: "BLOCKQUOTE" },
    { label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
    const editorRef = useRef<HTMLDivElement>(null);
    const gridOverlay = useRef<HTMLDivElement | null>(null);
    const gridColumns = useRef<HTMLDivElement[]>([]);
    const [blockType, setBlockType] = useState("P");
    const [isEmpty, setIsEmpty] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [showExtras, setShowExtras] = useState(false);
    const extrasMenuRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const extrasBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
    const [editorHtml, setEditorHtml] = useState<string>(""); // keep for save/load, not for rendering
    let gridOverlayEl: HTMLDivElement | null = null;
    let gridColumnsEl: HTMLDivElement[] = [];

    useEffect(() => {
        setMounted(true);
        // Fade in editor after a short delay for smoothness
        const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
        // Fade out loader after editor is visible
        const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
        return () => {
            clearTimeout(fadeInTimeout);
            clearTimeout(loaderTimeout);
        };
    }, []);

    // --- GRID OVERLAY SHOW/HIDE HELPERS ---
    function showGridOverlay() {
        ensureGridOverlay();
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'flex';
            gridOverlay.current.style.pointerEvents = 'auto';
            gridOverlay.current.style.zIndex = '99999';
        }
    }
    function hideGridOverlay() {
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'none';
        }
    }

    // Helper to focus editor and run command
    // Update format state immediately after running a command
    const runCommand = (command: string, value?: any) => {
        if (editorRef.current) {
            editorRef.current.focus();
            setTimeout(() => {
                if (value !== undefined) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command);
                }
                detectBlockType();
                checkEmpty();
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                });
                // --- Use zero-width non-breaking space for bold/strike toggle ---
                if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
                        let node = sel.anchorNode;
                        if (node && node.nodeType === 3 && node.parentElement) {
                            let parent = node.parentElement;
                            const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
                            const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
                            if (isBold || isStrike) {
                                const offset = sel.anchorOffset;
                                const text = node.textContent || '';
                                // Split the text node at the caret
                                const before = text.slice(0, offset);
                                const after = text.slice(offset);
                                node.textContent = before;
                                // Insert a zero-width non-breaking space after the formatting node
                                const zwsp = document.createTextNode('\uFEFF');
                                if (parent.nextSibling) {
                                    parent.parentNode.insertBefore(zwsp, parent.nextSibling);
                                } else {
                                    parent.parentNode.appendChild(zwsp);
                                }
                                // Move caret to the zwsp
                                const range = document.createRange();
                                range.setStart(zwsp, 1);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Remove the zwsp on next input
                                const cleanup = () => {
                                    if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
                                    editorRef.current?.removeEventListener('input', cleanup);
                                };
                                editorRef.current.addEventListener('input', cleanup);
                                // Optionally, also clean up on paste
                                editorRef.current.addEventListener('paste', cleanup, { once: true });
                            }
                        }
                    }
                }
            }, 0);
        }
    };

    // Helper for link creation with selection restore
    const handleLink = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        // Save selection
        const savedRange = range.cloneRange();
        const url = prompt("Enter URL:");
        if (url) {
            editorRef.current.focus();
            // Restore selection
            selection.removeAllRanges();
            selection.addRange(savedRange);
            setTimeout(() => {
                document.execCommand("createLink", false, url);
            }, 0);
        }
    };

    // Detect block type on selection change
    const detectBlockType = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.anchorNode as HTMLElement | null;
        if (node && node.nodeType === 3) node = node.parentElement;
        while (node && node !== editorRef.current) {
            const tag = node.tagName;
            if (
                tag === "H1" ||
                tag === "H2" ||
                tag === "H3" ||
                tag === "BLOCKQUOTE" ||
                tag === "PRE" ||
                tag === "P"
            ) {
                setBlockType(tag);
                return;
            }
            node = node.parentElement;
        }
        setBlockType("P");
    };

    // Check if editor is empty
    const checkEmpty = () => {
        let text = "";
        if (editorRef.current) {
            text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
        } else if (editorHtml) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = editorHtml;
            text = tempDiv.innerText.replace(/\n|\r/g, "").trim();
        }
        setIsEmpty(text === "");
    };

    useEffect(() => {
        document.addEventListener("selectionchange", detectBlockType);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", checkEmpty);
            editorRef.current.addEventListener("blur", checkEmpty);
        }
        return () => {
            document.removeEventListener("selectionchange", detectBlockType);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", checkEmpty);
                editorRef.current.removeEventListener("blur", checkEmpty);
            }
        };
    }, []);

    // --- GRID OVERLAY DYNAMIC LINES ---
    function updateGridOverlayLines() {
        if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
        const editor = editorRef.current;
        const style = window.getComputedStyle(editor);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) lineHeight = 28; // fallback
        const editorHeight = editor.offsetHeight;
        const numRows = Math.floor(editorHeight / lineHeight);
        // Remove old horizontal lines
        [...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
        // Add horizontal lines
        for (let r = 1; r < numRows; r++) {
            const hline = document.createElement('div');
            hline.className = 'docedit-grid-hline';
            hline.style.position = 'absolute';
            hline.style.left = '0';
            hline.style.right = '0';
            hline.style.top = (r * lineHeight) + 'px';
            hline.style.height = '0';
            hline.style.borderTop = '1px dashed #818cf8';
            hline.style.pointerEvents = 'none';
            gridOverlay.current.appendChild(hline);
        }
        // Remove old rows from columns
        gridColumns.current.forEach((col) => {
            [...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
        });
    }

    function ensureGridOverlay() {
        if (!editorRef.current) return;
        if (!gridOverlay.current) {
            const overlay = document.createElement('div');
            overlay.className = 'docedit-grid-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'row';
            overlay.style.gap = '0';
            gridColumns.current = [];
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.style.flex = '1 1 0';
                col.style.height = '100%';
                col.style.background = 'none';
                col.className = 'docedit-grid-col';
                overlay.appendChild(col);
                gridColumns.current.push(col);
            }
            editorRef.current.appendChild(overlay);
            gridOverlay.current = overlay;
        }
        gridOverlay.current.style.display = 'flex';
        gridOverlay.current.style.pointerEvents = 'auto';
        gridOverlay.current.style.zIndex = '99999';
    }

    // Inject styles only on client
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const styleId = 'docedit-blockstyle';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
              .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
              .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
              .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
              .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
              .document-editor p { margin: 0.5em 0; }
              .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
              .document-editor ul { list-style-type: disc; }
              .document-editor ol { list-style-type: decimal; }
              .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
              .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
            `;
            document.head.appendChild(style);
        }
        // Toolbar styles
        const toolbarStyleId = 'docedit-toolbar-style';
        if (!document.getElementById(toolbarStyleId)) {
            const style = document.createElement('style');
            style.id = toolbarStyleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                .editor-toolbar {
                    background: #18181b;
                    box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
                    border-bottom: 2px solid #52525b;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                    min-height: 3.5rem;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                }
                .toolbar-btn {
                    padding: 0.35rem 0.7rem;
                    border-radius: 0.375rem;
                    background: #27272a;
                    color: #f3f4f6;
                    font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    margin-right: 0.15rem;
                    margin-bottom: 0.1rem;
                    min-width: 1.7rem;
                    min-height: 1.7rem;
                    line-height: 1.2;
                    font-size: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    cursor: pointer;
                }
                .toolbar-btn:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn:hover {
                    background: #3f3f46;
                    color: #a5b4fc;
                }
                .toolbar-btn:active {
                    background: #52525b;
                    color: #f3f4f6;
                }
                .toolbar-icon .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined', sans-serif;
                    font-size: 1.35rem;
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    vertical-align: middle;
                    margin: 0;
                }
                .toolbar-dropdown {
                    min-width: 8rem;
                    font-size: 1.05rem;
                    font-weight: 600;
                    background: #18181b;
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    padding: 0.3rem 0.7rem;
                    border-radius: 0.375rem;
                }
                .toolbar-dropdown:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn.menu-item {
                  border: 1.5px solid transparent;
                  transition: border 0.15s, background 0.15s, color 0.15s;
                }
                .toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
                  border: 1.5px solid #818cf8;
                  background: #3f3f46;
                  color: #a5b4fc;
                }
                .toolbar-btn.active {
                  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
                  color: #fff;
                  border: 2px solid #a5b4fc;
                  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
                  text-shadow: 0 0 4px #818cf8;
                }
            `;
            document.head.appendChild(style);
        }
        // Gradient outline styles
        const gradientStyleId = 'docedit-gradient-outline-style';
        if (!document.getElementById(gradientStyleId)) {
            const style = document.createElement('style');
            style.id = gradientStyleId;
            style.innerHTML = `
    .gradient-outline {
      position: relative;
      border-radius: 0.75rem;
      z-index: 1;
      padding: 3px;
      background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
      transition: box-shadow 0.2s;
    }
    .gradient-outline:focus-within, .gradient-outline:hover {
      box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
    }
    `;
            document.head.appendChild(style);
        }
        // Grid overlay styles
        const gridStyleId = 'docedit-grid-style';
        if (!document.getElementById(gridStyleId)) {
            const style = document.createElement('style');
            style.id = gridStyleId;
            style.innerHTML = `
                .docedit-grid-overlay {
                    pointer-events: auto;
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 99999;
                    display: flex;
                    flex-direction: row;
                    gap: 0;
                }
                .docedit-grid-col {
                    flex: 1 1 0;
                    height: 100%;
                    background: rgba(129,140,248,0.18) /* Indigo-400, semi-transparent */;
                    border-left: 1px solid #6366f1;
                    border-right: 1px solid #6366f1;
                    position: relative;
                    transition: background 0.12s;
                }
                .docedit-grid-col:hover {
                    background: rgba(129,140,248,0.35);
                }
                .docedit-grid-row {
                    position: absolute;
                    left: 0; right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
                .docedit-grid-hline {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Save button gradient hover effect
        const saveBtnStyleId = 'docedit-save-btn-gradient-style';
        if (!document.getElementById(saveBtnStyleId)) {
            const style = document.createElement('style');
            style.id = saveBtnStyleId;
            style.innerHTML = `
                .save-btn-gradient {
                  background: #18181b;
                  border: 2px solid transparent;
                  box-shadow: none;
                  position: relative;
                  z-index: 1;
                  transition: background 0.5s cubic-bezier(.4,2,.6,1),
                              color 0.3s,
                              border 0.4s,
                              box-shadow 0.6s cubic-bezier(.4,2,.6,1);
                }
                .save-btn-gradient:hover, .save-btn-gradient:focus {
                  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
                  color: #fff;
                  border: 2px solid #a78bfa;
                  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
                }
            `;
            document.head.appendChild(style);
        }
        // Add custom link style for the editor (declare linkStyleId only once!)
        if (!document.getElementById('docedit-link-style')) {
            const style = document.createElement('style');
            style.id = 'docedit-link-style';
            style.innerHTML = `
                .document-editor a {
                    color: #22c55e;
                    text-decoration: underline;
                    font-weight: 600;
                    transition: color 0.15s, box-shadow 0.15s;
                    box-shadow: 0 1px 0 0 #22c55e44;
                    border-radius: 0.2em;
                    display: inline;
                    width: auto !important;
                    background: none;
                    padding: 0;
                    margin: 0;
                    line-height: inherit;
                    white-space: pre-wrap;
                }
                .document-editor a:hover, .document-editor a:focus {
                    color: #4ade80;
                    background: rgba(34,197,94,0.08);
                    box-shadow: 0 2px 8px 0 #22c55e33, 0 1px 0 0 #4ade80;
                    outline: none;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        const li = node.nodeType === 3 ? node.parentElement : node;
        if (li && li.tagName === 'LI' && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                li.remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        console.log('handleIndent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0'); // 2 non-breaking spaces for a visual tab
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { console.log('No parent list'); return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi = li.previousElementSibling;
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            console.log('Indented li into sublist');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No previous sibling, cannot indent first item');
            return;
        }
    }

    function handleOutdent() {
        console.log('handleOutdent called'); // DEBUG
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { console.log('No selection'); return; }
        let node = sel.anchorNode;
        let li = null;
        const chain = [];
        while (node) {
            chain.push(node.nodeName);
            if (node.nodeType === 1 && node.nodeName === 'LI') { li = node; break; }
            node = node.parentNode;
        }
        console.log('Parent chain:', chain);
        if (!li) { console.log('No <li> found'); return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            // Outdent: move li after its parent list
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            console.log('Outdented li to parent list');
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            console.log('No grandparent list, cannot outdent');
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                        img.style.width = img.width + 'px';
                        img.style.height = img.height + 'px';
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';
                wrapper.appendChild(img);
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';
                makeImageInteractive(img, wrapper);

                // Only insert if selection is inside the editor, otherwise append to editor
                let inserted = false;
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    let node = sel.anchorNode;
                    let insideEditor = false;
                    while (node) {
                        if (node === editorRef.current) { insideEditor = true; break; }
                        node = node.parentNode;
                    }
                    if (insideEditor) {
                        range.collapse(false);
                        range.insertNode(wrapper);
                        // Insert a zero-width space after the wrapper if it's at the end
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            const zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        if (wrapper.nextSibling) {
                            range.setStartAfter(wrapper.nextSibling);
                        } else {
                            range.setStartAfter(wrapper);
                        }
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        inserted = true;
                    }
                }
                if (!inserted) {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // Update format state on selection and input
    useEffect(() => {
        function updateFormatState() {
            setFormatState({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strike: document.queryCommandState('strikeThrough'),
            });
        }
        document.addEventListener('selectionchange', updateFormatState);
        if (editorRef.current) {
            editorRef.current.addEventListener('input', updateFormatState);
        }
        return () => {
            document.removeEventListener('selectionchange', updateFormatState);
            if (editorRef.current) {
                editorRef.current.removeEventListener('input', updateFormatState);
            }
        };
    }, []);

    // Add this helper to set up link interactivity
    function makeLinksInteractive() {
    if (!editorRef.current) return;
    // Remove any existing bubbles
    document.querySelectorAll('.docedit-link-bubble').forEach(b => b.remove());
    editorRef.current.querySelectorAll('a').forEach((a: HTMLAnchorElement) => {
        // Remove previous listeners to avoid stacking
        a.onmouseenter = null;
        a.onmouseleave = null;
        a.onmousedown = null;
        a.onmousemove = null;
        a.style.cursor = 'pointer';
        a.setAttribute('tabindex', '0');
        // Show bubble on hover
        a.onmouseenter = (e) => {
            // Remove any existing bubble
            document.querySelectorAll('.docedit-link-bubble').forEach(b => b.remove());
            const rect = a.getBoundingClientRect();
            const bubble = document.createElement('div');
            bubble.className = 'docedit-link-bubble';
            bubble.style.position = 'fixed';
            bubble.style.left = (rect.left + rect.width/2) + 'px';
            bubble.style.top = (rect.top + rect.height/2 + 24) + 'px';
            bubble.style.transform = 'translate(-50%, 0)';
            bubble.style.background = 'rgba(30,41,59,0.98)';
            bubble.style.color = '#fff';
            bubble.style.padding = '0.5em 1.2em 0.5em 1.2em';
            bubble.style.borderRadius = '0.7em';
            bubble.style.fontSize = '1.05em';
            bubble.style.zIndex = '2147483647';
            bubble.style.boxShadow = '0 2px 16px 0 #312e81';
            bubble.style.pointerEvents = 'none';
            bubble.style.whiteSpace = 'nowrap';
            bubble.style.transition = 'opacity 0.15s';
            bubble.innerHTML = `<span style='font-weight:500;'>${a.href}</span> <span style='margin-left:1em;color:#a5b4fc;font-size:0.98em;'>Ctrl+Click to open</span>`;
            document.body.appendChild(bubble);
        };
        a.onmouseleave = () => {
            document.querySelectorAll('.docedit-link-bubble').forEach(b => b.remove());
        };
        a.onmousedown = (e: MouseEvent) => {
            if (e.ctrlKey) {
                window.open(a.href, '_blank', 'noopener');
                e.preventDefault();
            }
        };
    });
}
// Call this after every input/change and after loading a document
useEffect(() => {
    if (!editorRef.current) return;
    const handler = () => makeLinksInteractive();
    editorRef.current.addEventListener('input', handler);
    // Also run once on mount and after load
    setTimeout(() => makeLinksInteractive(), 100);
    return () => {
        if (editorRef.current) editorRef.current.removeEventListener('input', handler);
    };
}, [editorRef, showEditor]);

    // Add this function inside your component:
    function makeImageInteractive(img: HTMLImageElement, wrapper: HTMLElement) {
    // --- Context menu logic ---
    img.oncontextmenu = function(e: MouseEvent) {
        e.preventDefault();
        let contextMenu: HTMLDivElement | null = document.querySelector('.docedit-img-contextmenu');
        if (contextMenu) contextMenu.remove();
        contextMenu = document.createElement('div');
        contextMenu.className = 'docedit-img-contextmenu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.background = '#18181b';
        contextMenu.style.border = '2px solid #6366f1';
        contextMenu.style.borderRadius = '0.5rem';
        contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
        contextMenu.style.zIndex = '2147483647';
        contextMenu.style.padding = '0.5em 0';
        contextMenu.style.minWidth = '120px';
        contextMenu.style.color = '#f3f4f6';
        contextMenu.style.fontSize = '1rem';
        contextMenu.style.display = 'flex';
        contextMenu.style.flexDirection = 'column';
        // Delete
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete Image';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = '#f87171';
        delBtn.style.padding = '0.5em 1em';
        delBtn.style.textAlign = 'left';
        delBtn.style.cursor = 'pointer';
        delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
        delBtn.onmouseleave = () => delBtn.style.background = 'none';
        delBtn.onclick = ev => {
            ev.stopPropagation();
            wrapper.remove();
            contextMenu?.remove();
            if (editorRef.current) {
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
            }
        };
        contextMenu.appendChild(delBtn);
        // Float left
        const leftBtn = document.createElement('button');
        leftBtn.textContent = 'Float Left';
        leftBtn.style.background = 'none';
        leftBtn.style.border = 'none';
        leftBtn.style.color = '#a5b4fc';
        leftBtn.style.padding = '0.5em 1em';
        leftBtn.style.textAlign = 'left';
        leftBtn.style.cursor = 'pointer';
        leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
        leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
        leftBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'left';
            img.style.display = 'inline';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(leftBtn);
        // Float right
        const rightBtn = document.createElement('button');
        rightBtn.textContent = 'Float Right';
        rightBtn.style.background = 'none';
        rightBtn.style.border = 'none';
        rightBtn.style.color = '#a5b4fc';
        rightBtn.style.padding = '0.5em 1em';
        rightBtn.style.textAlign = 'left';
        rightBtn.style.cursor = 'pointer';
        rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
        rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
        rightBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'right';
            img.style.display = 'inline';
            img.style.margin = '0.5em 0 0.5em 1em';
            contextMenu?.remove();
        };
        contextMenu.appendChild(rightBtn);
        // Inline
        const inlineBtn = document.createElement('button');
        inlineBtn.textContent = 'Inline';
        inlineBtn.style.background = 'none';
        inlineBtn.style.border = 'none';
        inlineBtn.style.color = '#a5b4fc';
        inlineBtn.style.padding = '0.5em 1em';
        inlineBtn.style.textAlign = 'left';
        inlineBtn.style.cursor = 'pointer';
        inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
        inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
        inlineBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = '';
            img.style.display = 'inline-block';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(inlineBtn);
        // Snap to Grid
        const gridBtn = document.createElement('button');
        gridBtn.textContent = 'Snap to Grid';
        gridBtn.style.background = 'none';
        gridBtn.style.border = 'none';
        gridBtn.style.color = '#a5b4fc';
        gridBtn.style.padding = '0.5em 1em';
        gridBtn.style.textAlign = 'left';
        gridBtn.style.cursor = 'pointer';
        gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
        gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
        gridBtn.onclick = ev => {
            ev.stopPropagation();
            contextMenu?.remove();
            showGridOverlay();
            // Wait for user to click a column
            gridColumns.current.forEach((col, i) => {
                col.style.cursor = 'pointer';
                col.onclick = e => {
                    if (!editorRef.current) return;
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const x = rect.left + i * colWidth + colWidth / 2;
                    let range: Range | null = null;
                    if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(x, rect.top + 10);
                    } else if ((document as any).caretPositionFromPoint) {
                        const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                        }
                    }
                    if (range && editorRef.current.contains(range.startContainer)) {
                        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                        if (range.startContainer.nodeType === 3) {
                            const textNode = range.startContainer as Text;
                            const offset = range.startOffset;
                            const before = textNode.textContent?.slice(0, offset) || '';
                            const after = textNode.textContent?.slice(offset) || '';
                            const parent = textNode.parentNode;
                            if (parent) {
                                if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                parent.insertBefore(wrapper, textNode);
                                if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                            }
                        } else {
                            range.insertNode(wrapper);
                        }
                        // Insert a zero-width space after if at end
                        let zwsp: Text | null = null;
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        const sel = window.getSelection();
                        if (sel) {
                            const r = document.createRange();
                            if (zwsp) {
                                r.setStartAfter(zwsp);
                            } else {
                                r.setStartAfter(wrapper);
                            }
                            r.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(r);
                            if (editorRef.current) editorRef.current.focus();
                        }
                    }
                    hideGridOverlay();
                    gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                };
            });
        };
        contextMenu.appendChild(gridBtn);
        // Untie/Retie
        const untieBtn = document.createElement('button');
        untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
        untieBtn.style.background = 'none';
        untieBtn.style.border = 'none';
        untieBtn.style.color = '#a5b4fc';
        untieBtn.style.padding = '0.5em 1em';
        untieBtn.style.textAlign = 'left';
        untieBtn.style.cursor = 'pointer';
        untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
        untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
        untieBtn.onclick = ev => {
            ev.stopPropagation();
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.setAttribute('data-untied', 'false');
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
                img.style.display = 'block';
            } else {
                wrapper.setAttribute('data-untied', 'true');
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
            }
            contextMenu?.remove();
        };
        contextMenu.appendChild(untieBtn);
        document.body.appendChild(contextMenu);
        const removeMenu = () => {
            contextMenu?.remove();
            contextMenu = null;
            document.removeEventListener('mousedown', onDocClick);
        };
        function onDocClick(ev: MouseEvent) {
            if (contextMenu && !contextMenu.contains(ev.target as Node)) {
                removeMenu();
            }
        }
        setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    };
    // --- Drag logic ---
    img.style.cursor = 'grab';
    let dragging = false, ghost: HTMLImageElement | null = null;
    img.onmousedown = function(e: MouseEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        const isUntied = wrapper.getAttribute('data-untied') === 'true';
        dragging = true;
        img.style.opacity = '0.5';
        ghost = img.cloneNode(true) as HTMLImageElement;
        ghost.style.opacity = '0.7';
        ghost.style.position = 'fixed';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '9999';
        let offsetX = 0, offsetY = 0;
        if (isUntied) {
            offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
            offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
            ghost.style.left = (e.clientX - offsetX) + 'px';
            ghost.style.top = (e.clientY - offsetY) + 'px';
        } else {
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';
        }
        document.body.appendChild(ghost);
        showGridOverlay();
        function onMouseMove(ev: MouseEvent) {
            if (!dragging || !ghost) return;
            if (isUntied) {
                ghost.style.left = (ev.clientX - img.width / 2) + 'px';
                ghost.style.top = (ev.clientY - img.height / 2) + 'px';
            } else {
                ghost.style.left = ev.clientX + 'px';
                ghost.style.top = ev.clientY + 'px';
            }
            // Highlight nearest grid column
            if (editorRef.current && gridColumns.current.length) {
                const rect = editorRef.current.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const colWidth = rect.width / 12;
                const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                gridColumns.current.forEach((col, i) => {
                    col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
                });
            }
        }
        function onMouseUp(ev: MouseEvent) {
            dragging = false;
            img.style.opacity = '1';
            if (ghost) ghost.remove();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            hideGridOverlay();
            if (editorRef.current) {
                const editorRect = editorRef.current.getBoundingClientRect();
                const imgW = img.width;
                const imgH = img.height;
                let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
                let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
                // Clamp to editor bounds
                x = Math.max(0, Math.min(x, editorRect.width - imgW));
                y = Math.max(0, Math.min(y, editorRect.height - imgH));
                if (isUntied) {
                    wrapper.setAttribute('data-untied', 'true');
                    wrapper.style.position = 'absolute';
                    wrapper.style.left = x + 'px';
                    wrapper.style.top = y + 'px';
                    wrapper.style.zIndex = '2147483645';
                    wrapper.style.pointerEvents = 'auto';
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                    editorRef.current.appendChild(wrapper);
                } else {
                    // Find the closest offset in the editor for this column
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                    const col = gridColumns.current[colIdx];
                    if (col) {
                        col.style.cursor = 'pointer';
                        col.onclick = e => {
                            if (!editorRef.current) return;
                            const rect = editorRef.current.getBoundingClientRect();
                            const colWidth = rect.width / 12;
                            const x = rect.left + colIdx * colWidth + colWidth / 2;
                            let range: Range | null = null;
                            if (document.caretRangeFromPoint) {
                                range = document.caretRangeFromPoint(x, rect.top + 10);
                            } else if ((document as any).caretPositionFromPoint) {
                                const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                                if (pos) {
                                    range = document.createRange();
                                    range.setStart(pos.offsetNode, pos.offset);
                                    range.collapse(true);
                                }
                            }
                            if (range && editorRef.current.contains(range.startContainer)) {
                                if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                                if (range.startContainer.nodeType === 3) {
                                    const textNode = range.startContainer as Text;
                                    const offset = range.startOffset;
                                    const before = textNode.textContent?.slice(0, offset) || '';
                                    const after = textNode.textContent?.slice(offset) || '';
                                    const parent = textNode.parentNode;
                                    if (parent) {
                                        if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                        parent.insertBefore(wrapper, textNode);
                                        if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                        if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                                    }
                                } else {
                                    range.insertNode(wrapper);
                                }
                                // Insert a zero-width space after if at end
                                let zwsp: Text | null = null;
                                if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                                    zwsp = document.createTextNode('\u200B');
                                    if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                                }
                                // Move caret after image (and zwsp)
                                const sel = window.getSelection();
                                if (sel) {
                                    const r = document.createRange();
                                    if (zwsp) {
                                        r.setStartAfter(zwsp);
                                    } else {
                                        r.setStartAfter(wrapper);
                                    }
                                    r.collapse(true);
                                    sel.removeAllRanges();
                                    sel.addRange(r);
                                    if (editorRef.current) editorRef.current.focus();
                                }
                            }
                            hideGridOverlay();
                            gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                        };
                    }
                }
            }
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    // --- Resize handle logic ---
    let cornerHandle = wrapper.querySelector('.docedit-img-resize-corner') as HTMLSpanElement | null;
    if (!cornerHandle) {
        cornerHandle = document.createElement('span');
        cornerHandle.className = 'docedit-img-resize-corner';
        cornerHandle.style.position = 'absolute';
        cornerHandle.style.right = '15px';
        cornerHandle.style.bottom = '6px';
        cornerHandle.style.width = '18px';
        cornerHandle.style.height = '18px';
        cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
        cornerHandle.style.border = '2.5px solid #6366f1';
        cornerHandle.style.borderRadius = '0 0 0.75rem 0';
        cornerHandle.style.cursor = 'nwse-resize';
        cornerHandle.style.zIndex = '10';
        cornerHandle.title = 'Resize (proportional)';
        cornerHandle.style.display = 'none';
        cornerHandle.setAttribute('contenteditable', 'false');
        cornerHandle.style.userSelect = 'none';
        cornerHandle.setAttribute('draggable', 'false');
        cornerHandle.tabIndex = -1;
        wrapper.appendChild(cornerHandle);
    }
    wrapper.onmouseenter = () => { cornerHandle!.style.display = 'block'; };
    wrapper.onmouseleave = () => { cornerHandle!.style.display = 'none'; };
    img.onfocus = () => { cornerHandle!.style.display = 'block'; };
    img.onblur = () => { cornerHandle!.style.display = 'none'; };
    let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
    function setImgSize(w: number, h: number) {
        img.width = w;
        img.height = h;
        img.style.width = w + 'px';
        img.style.height = h + 'px';
    }
    cornerHandle.onmousedown = function(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.width || img.naturalWidth;
        startHeight = img.height || img.naturalHeight;
        aspect = startWidth / startHeight;
        document.body.style.userSelect = 'none';
        function onMouseMove(ev: MouseEvent) {
            if (!resizing) return;
            const dx = ev.clientX - startX;
            let newWidth = Math.max(40, startWidth + dx);
            let newHeight = Math.max(40, newWidth / aspect);
            setImgSize(newWidth, newHeight);
        }
        function onMouseUp() {
            resizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.userSelect = '';
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    }

    // Move this to before the return statement so it's in scope for JSX
    function toast(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.innerHTML = `
          <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
          <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
        `;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'rgba(49,46,129,0.98)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 3500);
      }
    }

    // Add a separate toastSave function for the Save button
    function toastSave(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 2000);
      }
     }

    // Add this function inside your component:
    function saveDocument() {
      if (!editorRef.current) return;
      // Clone the editor content to avoid modifying the live DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      // Gather untied images (images not inside a block or grid, or with a special class)
      const images = Array.from(clone.querySelectorAll('img')).map(img => {
        // Get base64 data if possible
        let src = img.src;
        // If the image is a data URL, keep as is; otherwise, try to fetch and convert

        if (!src.startsWith('data:')) {
          // For remote images, skip or fetch as base64 (optional, not implemented here)
        }
        // Collect placement and style info
        return {
          src,
          style: img.getAttribute('style'),
          class: img.getAttribute('class'),
          width: img.width,
          height: img.height,
          alt: img.alt,
          id: img.id,
          parent: img.parentElement?.className || '',
          // Add more attributes as needed
        };
      });
      // Save the HTML (with image srcs as data URLs)
      const html = clone.innerHTML;
      // Bundle into a .havdoc JSON structure
      const doc = {
        type: 'havdoc',
        version: 1,
        html,
        images,
        savedAt: new Date().toISOString()
      };
      // Add magic header
      const magicHeader = 'HAVDOCv1\n';
      const blob = new Blob([
        magicHeader + JSON.stringify(doc, null, 2)
      ], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document-${Date.now()}.havdoc`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toastSave('Document saved!');
    }

    // Update rehydrateEditor to run after React renders new HTML
    function rehydrateEditor() {
        if (!editorRef.current) return;
        // For each image, re-apply wrappers and event listeners
        editorRef.current.querySelectorAll('img').forEach(img => {
            let wrapper = img.parentElement;
            // If not already wrapped, wrap it
            if (!wrapper || !wrapper.classList.contains('docedit-img-wrapper')) {
                wrapper = document.createElement('span');
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.style.background = 'none';
                img.parentNode?.insertBefore(wrapper, img);
                wrapper.appendChild(img);
            }
            // Restore tied/untied state
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
                // Restore left/top if present
                if (wrapper.style.left) wrapper.style.left = wrapper.style.left;
                if (wrapper.style.top) wrapper.style.top = wrapper.style.top;
            } else {
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
            }
            // Add handle if not present
            if (!wrapper.querySelector('.docedit-img-resize-corner')) {
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px';
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;
                wrapper.appendChild(cornerHandle);
            }
            // Make image interactive (context menu, drag, resize, etc.)
            makeImageInteractive(img, wrapper);
        });
        // Make all links interactive
        makeLinksInteractive();
    }

    // Add this function so onInput={handleEditorInput} works
    function handleEditorInput() {
        checkEmpty();
    }

    // Add this function before the return statement:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          const doc = JSON.parse(text);
          if (doc && typeof doc.html === 'string') {
            if (editorRef.current) {
              editorRef.current.innerHTML = doc.html;
              setEditorHtml(doc.html); // for saving later
              setTimeout(() => {
                rehydrateEditor();
                checkEmpty();
                toastSave('Document loaded!');
              }, 0);
            }
          }
        } catch (err) {
          toast('Failed to load document.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    // Render the editor and toolbar
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
                    {/* Gradient outline wrapper */}
                    <div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
                        <div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
                            {/* Toolbar ...existing code... */}
                            <div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
                                <div className="flex gap-1 items-center">
                                    <button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
                                        <span className="material-symbols-outlined">undo</span>
                                    </button>
                                    <button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
                                        <span className="material-symbols-outlined">redo</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <select
                                        className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
                                        value={blockType}
                                        onChange={e => {
                                            setBlockType(e.target.value);
                                            runCommand('formatBlock', e.target.value);
                                        }}
                                        title="Block type"
                                    >
                                        {BLOCK_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
                                        <span className="material-symbols-outlined">format_list_bulleted</span>
                                    </button>
                                    <button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </button>
                                    <button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
                                        <span className="material-symbols-outlined">format_indent_decrease</span>
                                    </button>
                                    <button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
                                        <span className="material-symbols-outlined">format_indent_increase</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
                                        <span className="material-symbols-outlined">link</span>
                                    </button>
                                    <button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
                                        <span className="material-symbols-outlined">link_off</span>
                                    </button>
                                </div>
                                {/* Save & Extras group at far right */}
                                <div className="flex gap-2 ml-auto items-center">
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        Load
                                    </button>
                                    <input
                                        type="file"
                                        accept=".havdoc"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        onChange={handleLoadDocument}
                                    />
                                    <button
                                        type="button"
                                        className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
                                        style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
                                        onClick={saveDocument}
                                    >
                                        Save
                                    </button>
                                    <div className="relative">
                                        <button
                                            ref={extrasBtnRef}
                                            type="button"
                                            className="toolbar-btn toolbar-icon"
                                            title="Extras"
                                            onClick={() => setShowExtras(e => !e)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                        {showExtras && createPortal(
                                            <div
                                                ref={extrasMenuRef}
                                                className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999] docedit-extras-menu"
                                                style={{
                                                    top: extrasBtnRef.current?.getBoundingClientRect().bottom + 4 + window.scrollY,
                                                    left: extrasBtnRef.current?.getBoundingClientRect().right - 224 + window.scrollX, // 224px = menu width
                                                }}
                                            >
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <b>B</b>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <i>I</i>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                <button
                                                type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <u>U</u>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                                                                            <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <s>S</s>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item"
                                                    onClick={() => {
                                                        setShowExtras(false);
                                                        setTimeout(() => imageInputRef.current?.click(), 100);
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined align-middle mr-2">image</span>
                                                    Insert Image
                                                </button>
                                            </div>,
                                            document.body
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleImageInsert}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Editor area and placeholder wrapper */}
                            <div style={{position: 'relative', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                                <div
                                    ref={editorRef}
                                    className="flex-1 flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
                                    contentEditable
                                    suppressContentEditableWarning
                                    spellCheck={true}
                                    aria-label="Document editor"
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onInput={handleEditorInput}
                                    style={{flex:1, minHeight:'0'}}
                                    onKeyDown={e => {
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            if (e.shiftKey) {
                                                handleOutdent();
                                            } else {
                                                handleIndent();
                                            }
                                        }
                                        handleEditorKeyDown(e);
                                    }}
                                />
                                {/* Overlay placeholder, absolutely positioned over the editor area */}
                                {isEmpty && !isFocused && (
                                    <span className="editor-placeholder" style={{
                                        position: 'absolute',
                                        left: '2.5rem',
                                        top: '2.5rem',
                                        zIndex: 10,
                                        userSelect: 'none',
                                        pointerEvents: 'none',
                                        color: '#9ca3af',
                                        fontSize: '1rem',
                                        transition: 'opacity 0.15s'
                                    }}>
                                        Start your document...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Loader overlay and fade-in logic remain unchanged */}
            {showLoader && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
                    <span className="loader" aria-label="Loading" />
                </div>
            )}
            {/* --- Close extras menu on outside click --- */}
            {showExtras && (
                <div
                    className="fixed inset-0 z-50"
                    onMouseDown={e => {
                        const menu = extrasMenuRef.current;
                        const btn = extrasBtnRef.current;
                        if (
                            menu && !menu.contains(e.target as Node) &&
                            btn && !btn.contains(e.target as Node)
                        ) {
                            setShowExtras(false);
                        }
                    }}
                />
            )}
        </div>
    );
}


//Broken code, but I don't know how to fix it right now, so I'm leaving it here for now

"use client";

import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";

// Get API base URL from env
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

const BLOCK_TYPES = [
    { label: "Paragraph", value: "P" },
    { label: "Heading 1", value: "H1" },
    { label: "Heading 2", value: "H2" },
    { label: "Heading 3", value: "H3" },
    { label: "Blockquote", value: "BLOCKQUOTE" },
    { label: "Preformatted", value: "PRE" },
];

export default function DocumentEditPage() {
    const editorRef = useRef<HTMLDivElement>(null);
    const gridOverlay = useRef<HTMLDivElement | null>(null);
    const gridColumns = useRef<HTMLDivElement[]>([]);
    const [blockType, setBlockType] = useState("P");
    const [isEmpty, setIsEmpty] = useState(true);
    const [isFocused, setIsFocused] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [showEditor, setShowEditor] = useState(false);
    const [showLoader, setShowLoader] = useState(true);
    const [showExtras, setShowExtras] = useState(false);
    const extrasMenuRef = useRef<HTMLDivElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const extrasBtnRef = useRef<HTMLButtonElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [formatState, setFormatState] = useState({ bold: false, italic: false, underline: false, strike: false });
    const [editorHtml, setEditorHtml] = useState<string>(""); // keep for save/load, not for rendering
    let gridOverlayEl: HTMLDivElement | null = null;
    let gridColumnsEl: HTMLDivElement[] = [];

    // Dropdown state for load/save
    const [showLoadDropdown, setShowLoadDropdown] = useState(false);
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    const loadBtnRef = useRef<HTMLButtonElement>(null);
    const saveBtnRef = useRef<HTMLButtonElement>(null);

    // --- File manager modal state ---
    const [showFileManager, setShowFileManager] = useState(false);
    const [serverFiles, setServerFiles] = useState<string[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [fileError, setFileError] = useState<string | null>(null);

    // --- Autosave state ---
    const [autosaveEnabled, setAutosaveEnabled] = useState(true);
    const [currentServerFilename, setCurrentServerFilename] = useState<string | null>(null);
    const [currentAutosaveFilename, setCurrentAutosaveFilename] = useState<string | null>(null);
    const [currentLocalFilename, setCurrentLocalFilename] = useState<string | null>(null);
    const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastAutosavedContent = useRef<string>("");
    const [showAutosaveToast, setShowAutosaveToast] = useState(false);
    const [autosaveToastMsg, setAutosaveToastMsg] = useState<string>("");

    // --- Autosave recovery modal state ---
    const [showAutosaveRecoveryModal, setShowAutosaveRecoveryModal] = useState(false);
    const [autosaveFiles, setAutosaveFiles] = useState<string[]>([]);
    const [recoveringAutosave, setRecoveringAutosave] = useState<string | null>(null);

    useEffect(() => {
        setMounted(true);
        // Fade in editor after a short delay for smoothness
        const fadeInTimeout = setTimeout(() => setShowEditor(true), 100);
        // Fade out loader after editor is visible
        const loaderTimeout = setTimeout(() => setShowLoader(false), 600);
        return () => {
            clearTimeout(fadeInTimeout);
            clearTimeout(loaderTimeout);
        };
    }, []);

    // On mount, check for autosave files
    useEffect(() => {
        async function checkAutosaveFiles() {
            try {
                const res = await fetch(`${API_BASE}/files/list`, { credentials: 'include' });
                if (!res.ok) return;
                const files = await res.json();
                const autosaves = files.filter((f: string) => f.endsWith('.havdoc_auto'));
                if (autosaves.length > 0) {
                    setAutosaveFiles(autosaves);
                    setShowAutosaveRecoveryModal(true);
                }
            } catch {}
        }
        checkAutosaveFiles();
    }, []);

    // --- GRID OVERLAY SHOW/HIDE HELPERS ---
    function showGridOverlay() {
        ensureGridOverlay();
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'flex';
            gridOverlay.current.style.pointerEvents = 'auto';
            gridOverlay.current.style.zIndex = '99999';
        }
    }
    function hideGridOverlay() {
        if (gridOverlay.current) {
            gridOverlay.current.style.display = 'none';
        }
    }

    // Handler to clear the editor with confirmation
    const handleClearEditor = () => {
        if (window.confirm('Are you sure you want to clear the document? This cannot be undone.')) {
            if (editorRef.current) {
                editorRef.current.innerHTML = '';
                setIsEmpty(true);
                // Trigger input event to update state
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
            }
            setShowExtras(false);
        }
    };

    // Helper to focus editor and run command
    // Update format state immediately after running a command
    const runCommand = (command: string, value?: any) => {
        if (editorRef.current) {
            editorRef.current.focus();
            setTimeout(() => {
                if (value !== undefined) {
                    document.execCommand(command, false, value);
                } else {
                    document.execCommand(command);
                }
                detectBlockType();
                checkEmpty();
                setFormatState({
                    bold: document.queryCommandState('bold'),
                    italic: document.queryCommandState('italic'),
                    underline: document.queryCommandState('underline'),
                    strike: document.queryCommandState('strikeThrough'),
                });
                // --- Use zero-width non-breaking space for bold/strike toggle ---
                if ((command === 'bold' || command === 'strikeThrough') && editorRef.current) {
                    const sel = window.getSelection();
                    if (sel && sel.rangeCount === 1 && sel.isCollapsed) {
                        let node = sel.anchorNode;
                        if (node && node.nodeType === 3 && node.parentElement) {
                            let parent = node.parentElement;
                            const isBold = command === 'bold' && (parent.tagName === 'B' || parent.tagName === 'STRONG');
                            const isStrike = command === 'strikeThrough' && (parent.tagName === 'S' || parent.tagName === 'STRIKE');
                            if (isBold || isStrike) {
                                const offset = sel.anchorOffset;
                                const text = node.textContent || '';
                                // Split the text node at the caret
                                const before = text.slice(0, offset);
                                const after = text.slice(offset);
                                node.textContent = before;
                                // Insert a zero-width non-breaking space after the formatting node
                                const zwsp = document.createTextNode('\uFEFF');
                                if (parent.nextSibling) {
                                    parent.parentNode.insertBefore(zwsp, parent.nextSibling);
                                } else {
                                    parent.parentNode.appendChild(zwsp);
                                }
                                // Move caret to the zwsp
                                const range = document.createRange();
                                range.setStart(zwsp, 1);
                                range.collapse(true);
                                sel.removeAllRanges();
                                sel.addRange(range);
                                // Remove the zwsp on next input
                                const cleanup = () => {
                                    if (zwsp.parentNode && zwsp.parentNode.contains(zwsp)) zwsp.parentNode.removeChild(zwsp);
                                    editorRef.current?.removeEventListener('input', cleanup);
                                };
                                editorRef.current.addEventListener('input', cleanup);
                                // Optionally, also clean up on paste
                                editorRef.current.addEventListener('paste', cleanup, { once: true });
                            }
                        }
                    }
                }
            }, 0);
        }
    };

    // Helper for link creation with selection restore
    const handleLink = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        // Save selection
        const savedRange = range.cloneRange();
        const url = prompt("Enter URL:");
        if (url) {
            editorRef.current.focus();
            // Restore selection
            selection.removeAllRanges();
            selection.addRange(savedRange);
            setTimeout(() => {
                document.execCommand("createLink", false, url);
            }, 0);
        }
    };

    // Detect block type on selection change
    const detectBlockType = () => {
        if (!editorRef.current) return;
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        let node = selection.anchorNode as HTMLElement | null;
        if (node && node.nodeType === 3) node = node.parentElement;
        while (node && node !== editorRef.current) {
            const tag = node.tagName;
            if (
                tag === "H1" ||
                tag === "H2" ||
                tag === "H3" ||
                tag === "BLOCKQUOTE" ||
                tag === "PRE" ||
                tag === "P"
            ) {
                setBlockType(tag);
                return;
            }
            node = node.parentElement;
        }
        setBlockType("P");
    };

    // Check if editor is empty
    const checkEmpty = () => {
        let text = "";
        if (editorRef.current) {
            text = editorRef.current.innerText.replace(/\n|\r/g, "").trim();
        } else if (editorHtml) {
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = editorHtml;
            text = tempDiv.innerText.replace(/\n|\r/g, "").trim();
        }
        setIsEmpty(text === "");
    };

    useEffect(() => {
        document.addEventListener("selectionchange", detectBlockType);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", checkEmpty);
            editorRef.current.addEventListener("blur", checkEmpty);
        }
        return () => {
            document.removeEventListener("selectionchange", detectBlockType);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", checkEmpty);
                editorRef.current.removeEventListener("blur", checkEmpty);
            }
        };
    }, []);

    // --- GRID OVERLAY DYNAMIC LINES ---
    function updateGridOverlayLines() {
        if (!editorRef.current || !gridOverlay.current || gridColumns.current.length === 0) return;
        const editor = editorRef.current;
        const style = window.getComputedStyle(editor);
        let lineHeight = parseFloat(style.lineHeight);
        if (isNaN(lineHeight)) lineHeight = 28; // fallback
        const editorHeight = editor.offsetHeight;
        const numRows = Math.floor(editorHeight / lineHeight);
        // Remove old horizontal lines
        [...gridOverlay.current.querySelectorAll('.docedit-grid-hline')].forEach(row => row.remove());
        // Add horizontal lines
        for (let r = 1; r < numRows; r++) {
            const hline = document.createElement('div');
            hline.className = 'docedit-grid-hline';
            hline.style.position = 'absolute';
            hline.style.left = '0';
            hline.style.right = '0';
            hline.style.top = (r * lineHeight) + 'px';
            hline.style.height = '0';
            hline.style.borderTop = '1px dashed #818cf8';
            hline.style.pointerEvents = 'none';
            gridOverlay.current.appendChild(hline);
        }
        // Remove old rows from columns
        gridColumns.current.forEach((col) => {
            [...col.querySelectorAll('.docedit-grid-row')].forEach(row => row.remove());
        });
    }

    function ensureGridOverlay() {
        if (!editorRef.current) return;
        if (!gridOverlay.current) {
            const overlay = document.createElement('div');
            overlay.className = 'docedit-grid-overlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.pointerEvents = 'auto';
            overlay.style.zIndex = '99999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'row';
            overlay.style.gap = '0';
            gridColumns.current = [];
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.style.flex = '1 1 0';
                col.style.height = '100%';
                col.style.background = 'none';
                col.className = 'docedit-grid-col';
                overlay.appendChild(col);
                gridColumns.current.push(col);
            }
            editorRef.current.appendChild(overlay);
            gridOverlay.current = overlay;
        }
        gridOverlay.current.style.display = 'flex';
        gridOverlay.current.style.pointerEvents = 'auto';
        gridOverlay.current.style.zIndex = '99999';
    }

    // Inject styles only on client
    useEffect(() => {
        if (typeof window === 'undefined') return;
        const styleId = 'docedit-blockstyle';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
              .document-editor h1 { font-size: 2.25rem; font-weight: bold; margin: 1.2em 0 0.5em 0; }
              .document-editor h2 { font-size: 1.5rem; font-weight: bold; margin: 1em 0 0.5em 0; }
              .document-editor h3 { font-size: 1.17rem; font-weight: bold; margin: 0.8em 0 0.4em 0; }
              .document-editor blockquote { border-left: 4px solid #d1d5db; color: #6b7280; margin: 1em 0; padding-left: 1em; font-style: italic; background: #f9fafb; }
              .document-editor pre { background: #f3f4f6; color: #111827; padding: 1em; border-radius: 0.375rem; font-family: monospace; font-size: 1em; margin: 1em 0; }
              .document-editor p { margin: 0.5em 0; }
              .document-editor ul, .document-editor ol { margin: 0.5em 0 0.5em 0.5em; padding-left: 0.75em; color: #f3f4f6; }
              .document-editor ul { list-style-type: disc; }
              .document-editor ol { list-style-type: decimal; }
              .document-editor li { margin: 0.25em 0; min-height: 1.5em; }
              .editor-placeholder { color: #9ca3af; pointer-events: none; position: absolute; left: 2rem; top: 2rem; z-index: 10; user-select: none; font-size: 1rem; transition: opacity 0.15s; }
            `;
            document.head.appendChild(style);
        }
        // Toolbar styles
        const toolbarStyleId = 'docedit-toolbar-style';
        if (!document.getElementById(toolbarStyleId)) {
            const style = document.createElement('style');
            style.id = toolbarStyleId;
            style.innerHTML = `
                @import url('https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined');
                .editor-toolbar {
                    background: #18181b;
                    box-shadow: 0 4px 16px 0 rgba(30,41,59,0.10);
                    border-bottom: 2px solid #52525b;
                    padding-left: 1.5rem;
                    padding-right: 1.5rem;
                    min-height: 3.5rem;
                    border-top-left-radius: 0.75rem;
                    border-top-right-radius: 0.75rem;
                    z-index: 2147483647;
                    position: sticky;
                    top: 0;
                }
                .toolbar-btn {
                    padding: 0.35rem 0.7rem;
                    border-radius: 0.375rem;
                    background: #27272a;
                    color: #f3f4f6;
                    font-weight: 500;
                    transition: background 0.15s, color 0.15s;
                    margin-right: 0.15rem;
                    margin-bottom: 0.1rem;
                    min-width: 1.7rem;
                    min-height: 1.7rem;
                    line-height: 1.2;
                    font-size: 1.15rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: none;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    cursor: pointer;
                }
                .toolbar-btn:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn:hover {
                    background: #3f3f46;
                    color: #a5b4fc;
                }
                .toolbar-btn:active {
                    background: #52525b;
                    color: #f3f4f6;
                }
                .toolbar-icon .material-symbols-outlined {
                    font-family: 'Material Symbols Outlined', sans-serif;
                    font-size: 1.35rem;
                    font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
                    vertical-align: middle;
                    margin: 0;
                }
                .toolbar-dropdown {
                    min-width: 8rem;
                    font-size: 1.05rem;
                    font-weight: 600;
                    background: #18181b;
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 1px 2px 0 rgba(30,41,59,0.04);
                    padding: 0.3rem 0.7rem;
                    border-radius: 0.375rem;
                }
                .toolbar-dropdown:focus {
                    outline: 2px solid #818cf8;
                    outline-offset: 1px;
                }
                .toolbar-btn.menu-item {
                  border: 1.5px solid transparent;
                  transition: border 0.15s, background 0.15s, color 0.15s;
                }
                .toolbar-btn.menu-item:hover, .toolbar-btn.menu-item:focus {
                  border: 1.5px solid #818cf8;
                  background: #3f3f46;
                  color: #a5b4fc;
                }
                .toolbar-btn.active {
                  background: linear-gradient(90deg, #6366f1 0%, #818cf8 100%);
                  color: #fff;
                  border: 2px solid #a5b4fc;
                  box-shadow: 0 0 8px 2px #818cf8, 0 0 0 2px #312e81;
                  text-shadow: 0 0 4px #818cf8;
                }
            `;
            document.head.appendChild(style);
        }
        // Gradient outline styles
        const gradientStyleId = 'docedit-gradient-outline-style';
        if (!document.getElementById(gradientStyleId)) {
            const style = document.createElement('style');
            style.id = gradientStyleId;
            style.innerHTML = `
    .gradient-outline {
      position: relative;
      border-radius: 0.75rem;
      z-index: 1;
      padding: 3px;
      background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
      box-shadow: 0 0 0 4px rgba(59,130,246,0.18), 0 0 24px 2px #a78bfa66;
      transition: box-shadow 0.2s;
    }
    .gradient-outline:focus-within, .gradient-outline:hover {
      box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
    }
    `;
            document.head.appendChild(style);
        }
        // Grid overlay styles
        const gridStyleId = 'docedit-grid-style';
        if (!document.getElementById(gridStyleId)) {
            const style = document.createElement('style');
            style.id = gridStyleId;
            style.innerHTML = `
                .docedit-grid-overlay {
                    pointer-events: auto;
                    position: absolute;
                    top: 0; left: 0; width: 100%; height: 100%;
                    z-index: 99999;
                    display: flex;
                    flex-direction: row;
                    gap: 0;
                }
                .docedit-grid-col {
                    flex: 1 1 0;
                    height: 100%;
                    background: rgba(129,140,248,0.18) /* Indigo-400, semi-transparent */;
                    border-left: 1px solid #6366f1;
                    border-right: 1px solid #6366f1;
                    position: relative;
                    transition: background 0.12s;
                }
                .docedit-grid-col:hover {
                    background: rgba(129,140,248,0.35);
                }
                .docedit-grid-row {
                    position: absolute;
                    left: 0; right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
                .docedit-grid-hline {
                    position: absolute;
                    left: 0;
                    right: 0;
                    height: 0;
                    border-top: 1px dashed #818cf8;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Save button gradient hover effect
        const saveBtnStyleId = 'docedit-save-btn-gradient-style';
        if (!document.getElementById(saveBtnStyleId)) {
            const style = document.createElement('style');
            style.id = saveBtnStyleId;
            style.innerHTML = `
                .save-btn-gradient {
                  background: #18181b;
                  border: 2px solid transparent;
                  box-shadow: none;
                  position: relative;
                  z-index: 1;
                  transition: background 0.5s cubic-bezier(.4,2,.6,1),
                              color 0.3s,
                              border 0.4s,
                              box-shadow 0.6s cubic-bezier(.4,2,.6,1);
                }
                .save-btn-gradient:hover, .save-btn-gradient:focus {
                  background: linear-gradient(120deg, #3b82f6 0%, #10b981 60%, #a78bfa 100%);
                  color: #fff;
                  border: 2px solid #a78bfa;
                  box-shadow: 0 0 0 6px #a78bfa99, 0 0 32px 4px #22d3ee88;
                }
            `;
            document.head.appendChild(style);
        }
        // Add custom link style for the editor (declare linkStyleId only once!)
        if (!document.getElementById('docedit-link-style')) {
            const style = document.createElement('style');
            style.id = 'docedit-link-style';
            style.innerHTML = `
                .document-editor a {
                    color: #22c55e;
                    text-decoration: underline;
                    font-weight: 600;
                    transition: color 0.15s, box-shadow 0.15s;
                    box-shadow: 0 1px 0 0 #22c55e44;
                    border-radius: 0.2em;
                    display: inline;
                    width: auto !important;
                    background: none;
                    padding: 0;
                    margin: 0;
                    line-height: inherit;
                    white-space: pre-wrap;
                }
                .document-editor a:hover, .document-editor a:focus {
                    color: #4ade80;
                    background: rgba(34,197,94,0.08);
                    box-shadow: 0 2px 8px 0 #22c55e33, 0 1px 0 0 #4ade80;
                    outline: none;
                }
            `;
            document.head.appendChild(style);
        }
        // Add red hover style for clear button
        if (!document.getElementById('docedit-clear-btn-style')) {
            const style = document.createElement('style');
            style.id = 'docedit-clear-btn-style';
            style.innerHTML = `
                .docedit-clear-btn {
                    color: #f87171;
                    transition: background 0.15s, color 0.15s;
                }
                .docedit-clear-btn:hover, .docedit-clear-btn:focus {
                    background: #7f1d1d !important;
                    color: #fff !important;
                }
            `;
            document.head.appendChild(style);
        }
        // Dropdown styles for load/save
        if (!document.getElementById('docedit-dropdown-style')) {
            const style = document.createElement('style');
            style.id = 'docedit-dropdown-style';
            style.innerHTML = `
                .docedit-dropdown-menu {
                    position: absolute;
                    min-width: 8rem;
                    background: linear-gradient(120deg, #18181b 0%, #23234a 100%);
                    color: #f3f4f6;
                    border: 2px solid #52525b;
                    box-shadow: 0 4px 24px 0 #000a;
                    border-radius: 0.5rem;
                    z-index: 2147483647;
                    padding: 0.25rem 0;
                    margin-top: 0.5rem;
                    font-size: 1.08rem;
                    font-weight: 500;
                    display: none;
                }
                .docedit-dropdown-menu.show {
                    display: block;
                }
                .docedit-dropdown-item {
                    width: 100%;
                    padding: 0.6em 1.2em;
                    background: none;
                    border: none;
                    color: #f3f4f6;
                    text-align: left;
                    cursor: pointer;
                    transition: background 0.15s, color 0.15s;
                    font-size: 1.08rem;
                }
                .docedit-dropdown-item:hover, .docedit-dropdown-item:focus {
                    background: #23234a;
                    color: #a5b4fc;
                }
            `;
            document.head.appendChild(style);
        }
    }, []);

    // --- Fetch file list from server ---
    async function fetchServerFiles() {
        setLoadingFiles(true);
        setFileError(null);
        try {
            const res = await fetch(`${API_BASE}/files/list`, { credentials: 'include' });
            if (!res.ok) throw new Error("Failed to fetch file list");
            const files = await res.json();
            setServerFiles(files);
        } catch (err: any) {
            setFileError(err.message || "Unknown error");
        } finally {
            setLoadingFiles(false);
        }
    }

    // --- Download and load file into editor ---
    async function handleServerFileLoad(filename: string) {
        setFileError(null);
        try {
            // Add cache-busting param and force reload
            const res = await fetch(`${API_BASE}/files/download/${encodeURIComponent(filename)}?t=${Date.now()}`, { credentials: 'include', cache: 'reload' });
            if (!res.ok) throw new Error("Failed to download file");
            const blob = await res.blob();
            const text = await blob.text();
            if (editorRef.current) {
                editorRef.current.innerHTML = text;
                setIsEmpty(false);
                // Trigger input event to update state
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
                lastAutosavedContent.current = text;
            }
            setShowFileManager(false);
            setCurrentServerFilename(filename); // Track loaded server file
            setCurrentLocalFilename(null); // Clear local file state
            setCurrentAutosaveFilename(filename.replace(/\.havdoc$/, '.havdoc_auto'));
            showAutosaveToast("Autosave is ON"); // Show toast after loading
        } catch (err: any) {
            setFileError(err.message || "Unknown error");
        }
    }

    // --- Save document to server, with overwrite or rename prompt if loaded from server ---
    async function saveDocumentToServer() {
        let fileName = currentServerFilename;
        let isOverwrite = false;
        if (fileName) {
            const choice = confirm(`You are editing: ${fileName}\n\nClick OK to overwrite this file, or Cancel to save as a new file.`);
            if (choice) {
                isOverwrite = true;
            } else {
                fileName = prompt("Enter a new file name (without extension):");
                if (!fileName) return;
                fileName = fileName.trim();
                if (!fileName.endsWith('.havdoc')) fileName += '.havdoc';
            }
        } else {
            fileName = prompt("Enter a file name (without extension):");
            if (!fileName) return;
            fileName = fileName.trim();
            if (!fileName.endsWith('.havdoc')) fileName += '.havdoc';
        }
        if (!editorRef.current) return;
        const content = editorRef.current.innerHTML;
        const blob = new Blob([content], { type: 'text/plain' });
        const formData = new FormData();
        formData.append('file', blob, fileName);
        try {
            const res = await fetch(`${API_BASE}/files/upload`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to save file to server');
            setCurrentServerFilename(fileName);
            setCurrentAutosaveFilename(fileName.replace(/\.havdoc$/, '.havdoc_auto'));
            // Delete autosave file after successful save
            await fetch(`${API_BASE}/files/delete/${encodeURIComponent(fileName.replace(/\.havdoc$/, '.havdoc_auto'))}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            // Refresh file list after save
            await fetchServerFiles();
            // Optionally reload the file to confirm overwrite
            // await handleServerFileLoad(fileName);
            const now = new Date();
            setAutosaveToastMsg(`Saved: ${fileName} (${now.toLocaleTimeString()})`);
            setShowAutosaveToast(true);
            setTimeout(() => setShowAutosaveToast(false), 2000);
            lastAutosavedContent.current = content;
        } catch (err: any) {
            alert('Error saving file: ' + (err.message || err));
        }
    }

    // --- AUTOSAVE LOGIC ---
    useEffect(() => {
        if (!autosaveEnabled || !currentServerFilename) {
            if (autosaveIntervalRef.current) {
                clearInterval(autosaveIntervalRef.current);
                autosaveIntervalRef.current = null;
            }
            return;
        }
        autosaveIntervalRef.current = setInterval(async () => {
            if (!editorRef.current) return;
            const content = editorRef.current.innerHTML;
            if (content === lastAutosavedContent.current) return;
            const autosaveFile = currentServerFilename.replace(/\.havdoc$/, '.havdoc_auto');
            const blob = new Blob([content], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', blob, autosaveFile);
            try {
                await fetch(`${API_BASE}/files/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });
                lastAutosavedContent.current = content;
                setAutosaveToastMsg('Autosaved!');
                setShowAutosaveToast(true);
                setTimeout(() => setShowAutosaveToast(false), 1200);
            } catch (err) {
                // Optionally show error
            }
        }, 10000);
        return () => {
            if (autosaveIntervalRef.current) {
                clearInterval(autosaveIntervalRef.current);
                autosaveIntervalRef.current = null;
            }
        };
    }, [autosaveEnabled, currentServerFilename]);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        let li: HTMLElement | null = null;
        if (node.nodeType === 3 && node.parentElement && node.parentElement.tagName === 'LI') {
            li = node.parentElement;
        } else if (node.nodeType === 1 && (node as HTMLElement).tagName === 'LI') {
            li = node as HTMLElement;
        }
        if (li && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                if ('remove' in li) (li as HTMLElement).remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { return; }
        let node = sel.anchorNode;
        let li: HTMLElement | null = null;
        while (node) {
            if (node.nodeType === 1 && (node as HTMLElement).tagName === 'LI') { li = node as HTMLElement; break; }
            node = node.parentNode;
        }
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0');
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi: HTMLElement | null = null;
        if ('previousElementSibling' in li && (li as HTMLElement).previousElementSibling) {
            prevLi = (li as HTMLElement).previousElementSibling as HTMLElement;
        }
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            return;
        }
    }

    function handleOutdent() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { return; }
        let node = sel.anchorNode;
        let li: HTMLElement | null = null;
        while (node) {
            if (node.nodeType === 1 && (node as HTMLElement).tagName === 'LI') { li = node as HTMLElement; break; }
            node = node.parentNode;
        }
        if (!li) { return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';
                wrapper.appendChild(img);
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';
                makeImageInteractive(img, wrapper);

                // Only insert if selection is inside the editor, otherwise append to editor
                let inserted = false;
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    let node = sel.anchorNode;
                    let insideEditor = false;
                    while (node) {
                        if (node === editorRef.current) { insideEditor = true; break; }
                        node = node.parentNode;
                    }
                    if (insideEditor) {
                        range.collapse(false);
                        range.insertNode(wrapper);
                        // Insert a zero-width space after the wrapper if it's at the end
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            const zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        if (wrapper.nextSibling) {
                            range.setStartAfter(wrapper.nextSibling);
                        } else {
                            range.setStartAfter(wrapper);
                        }
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        inserted = true;
                    }
                }
                if (!inserted) {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
            }
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    }

    // Update format state on selection and input
    useEffect(() => {
        function updateFormatState() {
            setFormatState({
                bold: document.queryCommandState('bold'),
                italic: document.queryCommandState('italic'),
                underline: document.queryCommandState('underline'),
                strike: document.queryCommandState('strikeThrough'),
            });
        }
        document.addEventListener("selectionchange", updateFormatState);
        if (editorRef.current) {
            editorRef.current.addEventListener("input", updateFormatState);
        }
        return () => {
            document.removeEventListener("selectionchange", updateFormatState);
            if (editorRef.current) {
                editorRef.current.removeEventListener("input", updateFormatState);
            }
        };
    }, []);

    // Add this helper to set up link interactivity
    function makeLinksInteractive() {
    if (!editorRef.current) return;
    // Remove any existing bubbles
    document.querySelectorAll('.docedit-link-bubble').forEach(b => b.remove());
    editorRef.current.querySelectorAll('a').forEach((a: HTMLAnchorElement) => {
        // Remove previous listeners to avoid stacking
        a.onmouseenter = null;
        a.onmouseleave = null;
        a.onmousedown = null;
        a.onmousemove = null;
        a.style.cursor = 'pointer';
        a.setAttribute('tabindex', '0');
        // Show bubble on hover
        a.onmouseenter = (e) => {
            // Remove any existing bubble
            document.querySelectorAll('.docedit-link-bubble').forEach(b => b.remove());
            const rect = a.getBoundingClientRect();
            const bubble = document.createElement('div');
            bubble.className = 'docedit-link-bubble';
            bubble.style.position = 'fixed';
            bubble.style.left = (rect.left + rect.width/2) + 'px';
            bubble.style.top = (rect.top + rect.height/2 + 24) + 'px';
            bubble.style.transform = 'translate(-50%, 0)';
            bubble.style.background = 'rgba(30,41,59,0.98)';
            bubble.style.color = '#fff';
            bubble.style.padding = '0.5em 1.2em 0.5em 1.2em';
            bubble.style.borderRadius = '0.7em';
            bubble.style.fontSize = '1.05em';
            bubble.style.zIndex = '2147483647';
            bubble.style.boxShadow = '0 2px 16px 0 #312e81';
            bubble.style.pointerEvents = 'none';
            bubble.style.whiteSpace = 'nowrap';
            bubble.style.transition = 'opacity 0.15s';
            bubble.innerHTML = `<span style='font-weight:500;'>${a.href}</span> <span style='margin-left:1em;color:#a5b4fc;font-size:0.98em;'>Ctrl+Click to open</span>`;
            document.body.appendChild(bubble);
        };
        a.onmouseleave = () => {
            document.querySelectorAll('.docedit-link-bubble').forEach(b => b.remove());
        };
        a.onmousedown = (e: MouseEvent) => {
            if (e.ctrlKey) {
                window.open(a.href, '_blank', 'noopener');
                e.preventDefault();
            }
        };
    });
}
// Call this after every input/change and after loading a document
useEffect(() => {
    if (!editorRef.current) return;
    const handler = () => makeLinksInteractive();
    editorRef.current.addEventListener('input', handler);
    // Also run once on mount and after load
    setTimeout(() => makeLinksInteractive(), 100);
    return () => {
        if (editorRef.current) editorRef.current.removeEventListener('input', handler);
    };
}, [editorRef, showEditor]);

    // Add this function inside your component:
    function makeImageInteractive(img: HTMLImageElement, wrapper: HTMLElement) {
    // --- Context menu logic ---
    img.oncontextmenu = function(e: MouseEvent) {
        e.preventDefault();
        let contextMenu: HTMLDivElement | null = document.querySelector('.docedit-img-contextmenu');
        if (contextMenu) contextMenu.remove();
        contextMenu = document.createElement('div');
        contextMenu.className = 'docedit-img-contextmenu';
        contextMenu.style.position = 'fixed';
        contextMenu.style.left = e.clientX + 'px';
        contextMenu.style.top = e.clientY + 'px';
        contextMenu.style.background = '#18181b';
        contextMenu.style.border = '2px solid #6366f1';
        contextMenu.style.borderRadius = '0.5rem';
        contextMenu.style.boxShadow = '0 4px 24px 0 #000a';
        contextMenu.style.zIndex = '2147483647';
        contextMenu.style.padding = '0.5em 0';
        contextMenu.style.minWidth = '120px';
        contextMenu.style.color = '#f3f4f6';
        contextMenu.style.fontSize = '1rem';
        contextMenu.style.display = 'flex';
        contextMenu.style.flexDirection = 'column';
        // Delete
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete Image';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = '#f87171';
        delBtn.style.padding = '0.5em 1em';
        delBtn.style.textAlign = 'left';
        delBtn.style.cursor = 'pointer';
        delBtn.onmouseenter = () => delBtn.style.background = '#27272a';
        delBtn.onmouseleave = () => delBtn.style.background = 'none';
        delBtn.onclick = ev => {
            ev.stopPropagation();
            wrapper.remove();
            contextMenu?.remove();
            if (editorRef.current) {
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);
            }
        };
        contextMenu.appendChild(delBtn);
        // Float left
        const leftBtn = document.createElement('button');
        leftBtn.textContent = 'Float Left';
        leftBtn.style.background = 'none';
        leftBtn.style.border = 'none';
        leftBtn.style.color = '#a5b4fc';
        leftBtn.style.padding = '0.5em 1em';
        leftBtn.style.textAlign = 'left';
        leftBtn.style.cursor = 'pointer';
        leftBtn.onmouseenter = () => leftBtn.style.background = '#27272a';
        leftBtn.onmouseleave = () => leftBtn.style.background = 'none';
        leftBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'left';
            img.style.display = 'inline';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(leftBtn);
        // Float right
        const rightBtn = document.createElement('button');
        rightBtn.textContent = 'Float Right';
        rightBtn.style.background = 'none';
        rightBtn.style.border = 'none';
        rightBtn.style.color = '#a5b4fc';
        rightBtn.style.padding = '0.5em 1em';
        rightBtn.style.textAlign = 'left';
        rightBtn.style.cursor = 'pointer';
        rightBtn.onmouseenter = () => rightBtn.style.background = '#27272a';
        rightBtn.onmouseleave = () => rightBtn.style.background = 'none';
        rightBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = 'right';
            img.style.display = 'inline';
            img.style.margin = '0.5em 0 0.5em 1em';
            contextMenu?.remove();
        };
        contextMenu.appendChild(rightBtn);
        // Inline
        const inlineBtn = document.createElement('button');
        inlineBtn.textContent = 'Inline';
        inlineBtn.style.background = 'none';
        inlineBtn.style.border = 'none';
        inlineBtn.style.color = '#a5b4fc';
        inlineBtn.style.padding = '0.5em 1em';
        inlineBtn.style.textAlign = 'left';
        inlineBtn.style.cursor = 'pointer';
        inlineBtn.onmouseenter = () => inlineBtn.style.background = '#27272a';
        inlineBtn.onmouseleave = () => inlineBtn.style.background = 'none';
        inlineBtn.onclick = ev => {
            ev.stopPropagation();
            img.style.float = '';
            img.style.display = 'inline-block';
            img.style.margin = '0.5em 1em 0.5em 0';
            contextMenu?.remove();
        };
        contextMenu.appendChild(inlineBtn);
        // Snap to Grid
        const gridBtn = document.createElement('button');
        gridBtn.textContent = 'Snap to Grid';
        gridBtn.style.background = 'none';
        gridBtn.style.border = 'none';
        gridBtn.style.color = '#a5b4fc';
        gridBtn.style.padding = '0.5em 1em';
        gridBtn.style.textAlign = 'left';
        gridBtn.style.cursor = 'pointer';
        gridBtn.onmouseenter = () => gridBtn.style.background = '#27272a';
        gridBtn.onmouseleave = () => gridBtn.style.background = 'none';
        gridBtn.onclick = ev => {
            ev.stopPropagation();
            contextMenu?.remove();
            showGridOverlay();
            // Wait for user to click a column
            gridColumns.current.forEach((col, i) => {
                col.style.cursor = 'pointer';
                col.onclick = e => {
                    if (!editorRef.current) return;
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const x = rect.left + i * colWidth + colWidth / 2;
                    let range: Range | null = null;
                    if (document.caretRangeFromPoint) {
                        range = document.caretRangeFromPoint(x, rect.top + 10);
                    } else if ((document as any).caretPositionFromPoint) {
                        const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                        if (pos) {
                            range = document.createRange();
                            range.setStart(pos.offsetNode, pos.offset);
                            range.collapse(true);
                        }
                    }
                    if (range && editorRef.current.contains(range.startContainer)) {
                        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                        if (range.startContainer.nodeType === 3) {
                            const textNode = range.startContainer as Text;
                            const offset = range.startOffset;
                            const before = textNode.textContent?.slice(0, offset) || '';
                            const after = textNode.textContent?.slice(offset) || '';
                            const parent = textNode.parentNode;
                            if (parent) {
                                if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                parent.insertBefore(wrapper, textNode);
                                if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                            }
                        } else {
                            range.insertNode(wrapper);
                        }
                        // Insert a zero-width space after if at end
                        let zwsp: Text | null = null;
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                          zwsp = document.createTextNode('\u200B');
                          if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        const sel = window.getSelection();
                        if (sel) {
                          const r = document.createRange();
                          if (zwsp) {
                            r.setStartAfter(zwsp);
                          } else {
                            r.setStartAfter(wrapper);
                          }
                          r.collapse(true);
                          sel.removeAllRanges();
                          sel.addRange(r);
                          if (editorRef.current) editorRef.current.focus();
                        }
                    }
                    hideGridOverlay();
                    gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                };
            });
        };
        contextMenu.appendChild(gridBtn);
        // Untie/Retie
        const untieBtn = document.createElement('button');
        untieBtn.textContent = wrapper.getAttribute('data-untied') === 'true' ? 'Retie (Inline/Float)' : 'Untie (Free Move)';
        untieBtn.style.background = 'none';
        untieBtn.style.border = 'none';
        untieBtn.style.color = '#a5b4fc';
        untieBtn.style.padding = '0.5em 1em';
        untieBtn.style.textAlign = 'left';
        untieBtn.style.cursor = 'pointer';
        untieBtn.onmouseenter = () => untieBtn.style.background = '#27272a';
        untieBtn.onmouseleave = () => untieBtn.style.background = 'none';
        untieBtn.onclick = ev => {
            ev.stopPropagation();
            const isUntied = wrapper.getAttribute('data-untied') === 'true';
            if (isUntied) {
                wrapper.setAttribute('data-untied', 'false');
                wrapper.style.position = '';
                wrapper.style.left = '';
                wrapper.style.top = '';
                wrapper.style.zIndex = '';
                wrapper.style.pointerEvents = '';
                img.style.display = 'block';
            } else {
                wrapper.setAttribute('data-untied', 'true');
                wrapper.style.position = 'absolute';
                wrapper.style.zIndex = '100';
                wrapper.style.pointerEvents = 'auto';
            }
            contextMenu?.remove();
        };
        contextMenu.appendChild(untieBtn);
        document.body.appendChild(contextMenu);
        const removeMenu = () => {
            contextMenu?.remove();
            contextMenu = null;
            document.removeEventListener('mousedown', onDocClick);
        };
        function onDocClick(ev: MouseEvent) {
            if (contextMenu && !contextMenu.contains(ev.target as Node)) {
                removeMenu();
            }
        }
        setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    };
    // --- Drag logic ---
    img.style.cursor = 'grab';
    let dragging = false, ghost: HTMLImageElement | null = null;
    img.onmousedown = function(e: MouseEvent) {
        if (e.button !== 0) return;
        e.preventDefault();
        const isUntied = wrapper.getAttribute('data-untied') === 'true';
        dragging = true;
        img.style.opacity = '0.5';
        ghost = img.cloneNode(true) as HTMLImageElement;
        ghost.style.opacity = '0.7';
        ghost.style.position = 'fixed';
        ghost.style.pointerEvents = 'none';
        ghost.style.zIndex = '2147483646'; // just below toolbar
        let offsetX = 0, offsetY = 0;
        if (isUntied) {
            offsetX = e.clientX - (img.getBoundingClientRect().left + img.width / 2);
            offsetY = e.clientY - (img.getBoundingClientRect().top + img.height / 2);
            ghost.style.left = (e.clientX - offsetX) + 'px';
            ghost.style.top = (e.clientY - offsetY) + 'px';
        } else {
            ghost.style.left = e.clientX + 'px';
            ghost.style.top = e.clientY + 'px';
        }
        document.body.appendChild(ghost);
        showGridOverlay();
        function onMouseMove(ev: MouseEvent) {
            if (!dragging || !ghost) return;
            if (isUntied) {
                ghost.style.left = (ev.clientX - img.width / 2) + 'px';
                ghost.style.top = (ev.clientY - img.height / 2) + 'px';
            } else {
                ghost.style.left = ev.clientX + 'px';
                ghost.style.top = ev.clientY + 'px';
            }
            // Highlight nearest grid column
            if (editorRef.current && gridColumns.current.length) {
                const rect = editorRef.current.getBoundingClientRect();
                const x = ev.clientX - rect.left;
                const colWidth = rect.width / 12;
                const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                gridColumns.current.forEach((col, i) => {
                    col.style.background = i === colIdx ? 'rgba(129,140,248,0.12)' : 'none';
                });
            }
        }
        function onMouseUp(ev: MouseEvent) {
            dragging = false;
            img.style.opacity = '1';
            if (ghost) ghost.remove();
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            hideGridOverlay();
            if (editorRef.current) {
                const editorRect = editorRef.current.getBoundingClientRect();
                const imgW = img.width;
                const imgH = img.height;
                let x = isUntied ? (ev.clientX - editorRect.left - imgW / 2) : (ev.clientX - editorRect.left);
                let y = isUntied ? (ev.clientY - editorRect.top - imgH / 2) : (ev.clientY - editorRect.top);
                // Clamp to editor bounds
                x = Math.max(0, Math.min(x, editorRect.width - imgW));
                y = Math.max(0, Math.min(y, editorRect.height - imgH));
                if (isUntied) {
                    wrapper.setAttribute('data-untied', 'true');
                    wrapper.style.position = 'absolute';
                    wrapper.style.left = x + 'px';
                    wrapper.style.top = y + 'px';
                    wrapper.style.zIndex = '2147483645';
                    wrapper.style.pointerEvents = 'auto';
                    if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                    editorRef.current.appendChild(wrapper);
                } else {
                    // Find the closest offset in the editor for this column
                    const rect = editorRef.current.getBoundingClientRect();
                    const colWidth = rect.width / 12;
                    const colIdx = Math.max(0, Math.min(11, Math.floor(x / colWidth)));
                    const col = gridColumns.current[colIdx];
                    if (col) {
                        col.style.cursor = 'pointer';
                        col.onclick = e => {
                          if (!editorRef.current) return;
                          const rect = editorRef.current.getBoundingClientRect();
                          const colWidth = rect.width / 12;
                          const x = rect.left + colIdx * colWidth + colWidth / 2;
                          let range: Range | null = null;
                          if (document.caretRangeFromPoint) {
                            range = document.caretRangeFromPoint(x, rect.top + 10);
                          } else if ((document as any).caretPositionFromPoint) {
                            const pos = (document as any).caretPositionFromPoint(x, rect.top + 10);
                            if (pos) {
                              range = document.createRange();
                              range.setStart(pos.offsetNode, pos.offset);
                              range.collapse(true);
                            }
                          }
                          if (range && editorRef.current.contains(range.startContainer)) {
                            if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
                            if (range.startContainer.nodeType === 3) {
                              const textNode = range.startContainer as Text;
                              const offset = range.startOffset;
                              const before = textNode.textContent?.slice(0, offset) || '';
                              const after = textNode.textContent?.slice(offset) || '';
                              const parent = textNode.parentNode;
                              if (parent) {
                                if (before) parent.insertBefore(document.createTextNode(before), textNode);
                                parent.insertBefore(wrapper, textNode);
                                if (after) parent.insertBefore(document.createTextNode(after), textNode);
                                if (parent && parent.contains(textNode)) parent.removeChild(textNode);
                              }
                            } else {
                              range.insertNode(wrapper);
                            }
                            // Insert a zero-width space after if at end
                            let zwsp: Text | null = null;
                            if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                              zwsp = document.createTextNode('\u200B');
                              if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                            }
                            // Move caret after image (and zwsp)
                            const sel = window.getSelection();
                            if (sel) {
                              const r = document.createRange();
                              if (zwsp) {
                                r.setStartAfter(zwsp);
                              } else {
                                r.setStartAfter(wrapper);
                              }
                              r.collapse(true);
                              sel.removeAllRanges();
                              sel.addRange(r);
                              if (editorRef.current) editorRef.current.focus();
                            }
                          }
                          hideGridOverlay();
                          gridColumns.current.forEach(col2 => { col2.onclick = null; col2.style.cursor = 'default'; });
                        };
                    }
                }
            }
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    // --- Resize handle logic ---
    let cornerHandle = wrapper.querySelector('.docedit-img-resize-corner') as HTMLSpanElement | null;
    if (!cornerHandle) {
        cornerHandle = document.createElement('span');
        cornerHandle.className = 'docedit-img-resize-corner';
        cornerHandle.style.position = 'absolute';
        cornerHandle.style.right = '15px';
        cornerHandle.style.bottom = '6px';
        cornerHandle.style.width = '18px';
        cornerHandle.style.height = '18px';
        cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
        cornerHandle.style.border = '2.5px solid #6366f1';
        cornerHandle.style.borderRadius = '0 0 0.75rem 0';
        cornerHandle.style.cursor = 'nwse-resize';
        cornerHandle.style.zIndex = '10';
        cornerHandle.title = 'Resize (proportional)';
        cornerHandle.style.display = 'none';
        cornerHandle.setAttribute('contenteditable', 'false');
        cornerHandle.style.userSelect = 'none';
        cornerHandle.setAttribute('draggable', 'false');
        cornerHandle.tabIndex = -1;
        wrapper.appendChild(cornerHandle);
    }
    wrapper.onmouseenter = () => { cornerHandle!.style.display = 'block'; };
    wrapper.onmouseleave = () => { cornerHandle!.style.display = 'none'; };
    img.onfocus = () => { cornerHandle!.style.display = 'block'; };
    img.onblur = () => { cornerHandle!.style.display = 'none'; };
    let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
    function setImgSize(w: number, h: number) {
        img.width = w;
        img.height = h;
        img.style.width = w + 'px';
        img.style.height = h + 'px';
    }
    cornerHandle.onmousedown = function(e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        resizing = true;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.width || img.naturalWidth;
        startHeight = img.height || img.naturalHeight;
        aspect = startWidth / startHeight;
        document.body.style.userSelect = 'none';
        function onMouseMove(ev: MouseEvent) {
            if (!resizing) return;
            const dx = ev.clientX - startX;
            let newWidth = Math.max(40, startWidth + dx);
            let newHeight = Math.max(40, newWidth / aspect);
            setImgSize(newWidth, newHeight);
        }

        function onMouseUp() {
            resizing = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };
    }

    // Move this to before the return statement so it's in scope for JSX
    function toast(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.innerHTML = `
          <div style="font-weight:bold; font-size:1.1rem;">SORRY! -</div>
          <div style="margin-top:0.25em;">Formatting tools are broken right now, I'm just as clueless as to why as you are--<br/>I am actively trying to get them to work, if you want to learn more, <a href='/docs/documentedit' style='color:#a5b4fc;text-decoration:underline;' target='_blank'>read this!</a></div>
        `;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'rgba(49,46,129,0.98)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity  0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; },  10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 3500);
      }
    }

    // Add a separate toastSave function for the Save button
    function toastSave(msg: string) {
      if (typeof window !== 'undefined') {
        let toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '2rem';
        toast.style.right = '-400px';
        toast.style.background = 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #ec4899 100%)';
        toast.style.color = '#fff';
        toast.style.padding = '1.1rem 1.7rem 1.1rem 1.3rem';
        toast.style.borderRadius = '0.7rem';
        toast.style.fontSize = '1.05rem';
        toast.style.zIndex = '2147483647';
        toast.style.boxShadow = '0 2px 16px 0 #312e81';
        toast.style.transition = 'right 0.4s cubic-bezier(.4,2,.6,1), opacity 0.3s';
        toast.style.opacity = '1';
        document.body.appendChild(toast);
        setTimeout(() => { toast.style.right = '2rem'; }, 10);
        setTimeout(() => {
          toast.style.opacity = '0';
          toast.style.right = '-400px';
          setTimeout(() => toast.remove(), 400);
        }, 2000);
      }
     }

    // Add this function inside your component:
    function saveDocument() {
      if (!editorRef.current) return;
      // Clone the editor content to avoid modifying the live DOM
      const clone = editorRef.current.cloneNode(true) as HTMLElement;
      // Gather untied images (images not inside a block or grid, or with a special class)
      const images = Array.from(clone.querySelectorAll('img')).map(img => {
        let src = img.src;
        if (!src.startsWith('data:')) {
          // For remote images, skip or fetch as base64 (optional, not implemented here)
        }
        return {
          src,
          style: img.getAttribute('style'),
          class: img.getAttribute('class'),
          width: img.width,
          height: img.height,
          alt: img.alt,
          id: img.id,
          parent: img.parentElement?.className || '',
          // Add more attributes as needed
        };
      });
      const html = clone.innerHTML;
      const doc = {
        type: 'havdoc',
        version: 1,
        html,
        images,
        savedAt: new Date().toISOString()
      };
      const magicHeader = 'HAVDOCv1\n';
      const blob = new Blob([
        magicHeader + JSON.stringify(doc, null, 2)
      ], { type: 'application/json' });
      let fileName = currentServerFilename || currentLocalFilename;
      if (!fileName) {
        fileName = prompt('Enter a file name (without extension):') || '';
        fileName = fileName.trim();
        if (!fileName) return;
        if (!fileName.endsWith('.havdoc')) fileName += '.havdoc';
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toastSave('Document saved!');
    }

    // --- Save document to server ("database") ---
    async function saveDocumentToServer() {
      let fileName = currentServerFilename;
      if (fileName) {
        const choice = confirm(`Overwrite ${fileName}? Click Cancel to save as a new file.`);
        if (!choice) {
          fileName = prompt("Enter a new file name (without extension):");
          if (!fileName) return;
          fileName = fileName.trim();
          if (!fileName.endsWith('.havdoc')) fileName += '.havdoc';
        }
      } else {
        fileName = prompt("Enter a file name (without extension):");
        if (!fileName) return;
        fileName = fileName.trim();
        if (!fileName.endsWith('.havdoc')) fileName += '.havdoc';
      }
      if (!editorRef.current) return;
      const content = editorRef.current.innerHTML;
      const blob = new Blob([content], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, fileName);
      try {
        const res = await fetch(`${API_BASE}/files/upload`, {
          method: 'POST',
          body: formData,
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Failed to save file to server');
        setCurrentServerFilename(fileName);
        setCurrentAutosaveFilename(fileName.replace(/\.havdoc$/, '.havdoc_auto'));
        // Delete autosave file after successful save
        await fetch(`${API_BASE}/files/delete/${encodeURIComponent(fileName.replace(/\.havdoc$/, '.havdoc_auto'))}`, {
          method: 'DELETE',
          credentials: 'include',
        });
        // Refresh file list after save
        await fetchServerFiles();
        // Optionally reload the file to confirm overwrite
        // await handleServerFileLoad(fileName);
        const now = new Date();
        setAutosaveToastMsg(`Saved: ${fileName} (${now.toLocaleTimeString()})`);
        setShowAutosaveToast(true);
        setTimeout(() => setShowAutosaveToast(false), 2000);
        lastAutosavedContent.current = content;
      } catch (err: any) {
        alert('Error saving file: ' + (err.message || err));
      }
    }

    // --- AUTOSAVE LOGIC ---
    useEffect(() => {
        if (!autosaveEnabled || !currentServerFilename) {
            if (autosaveIntervalRef.current) {
                clearInterval(autosaveIntervalRef.current);
                autosaveIntervalRef.current = null;
            }
            return;
        }
        autosaveIntervalRef.current = setInterval(async () => {
            if (!editorRef.current) return;
            const content = editorRef.current.innerHTML;
            if (content === lastAutosavedContent.current) return;
            const autosaveFile = currentServerFilename.replace(/\.havdoc$/, '.havdoc_auto');
            const blob = new Blob([content], { type: 'text/plain' });
            const formData = new FormData();
            formData.append('file', blob, autosaveFile);
            try {
                await fetch(`${API_BASE}/files/upload`, {
                    method: 'POST',
                    body: formData,
                    credentials: 'include',
                });
                lastAutosavedContent.current = content;
                setAutosaveToastMsg('Autosaved!');
                setShowAutosaveToast(true);
                setTimeout(() => setShowAutosaveToast(false), 1200);
            } catch (err) {
                // Optionally show error
            }
        }, 10000);
        return () => {
            if (autosaveIntervalRef.current) {
                clearInterval(autosaveIntervalRef.current);
                autosaveIntervalRef.current = null;
            }
        };
    }, [autosaveEnabled, currentServerFilename]);

    // Observe editor resize and update grid overlay lines
    useEffect(() => {
        if (!editorRef.current) return;
        const editor = editorRef.current;
        let resizeObserver: ResizeObserver | null = null;
        function handleUpdate() {
            updateGridOverlayLines();
        }
        resizeObserver = new window.ResizeObserver(handleUpdate);
        resizeObserver.observe(editor);
        editor.addEventListener('input', handleUpdate);
        setTimeout(handleUpdate, 100);
        return () => {
            resizeObserver?.disconnect();
            editor.removeEventListener('input', handleUpdate);
        };
    }, [editorRef]);

    // Custom list insertion for browsers where execCommand doesn't work
    function insertCustomList(type: 'ul' | 'ol') {
        console.log('insertCustomList called', type); // DEBUG
        const sel = window.getSelection();
        if (!sel) {
            console.log('No selection found');
            return;
        }
        if (!sel.rangeCount) {
            console.log('No range in selection');
            return;
        }
        const range = sel.getRangeAt(0);
        console.log('Range found:', range);
        // Check if selection is inside the editor
        let node = sel.anchorNode;
        let insideEditor = false;
        while (node) {
            if (node === editorRef.current) {
                insideEditor = true;
                break;
            }
            node = node.parentNode;
        }
        console.log('Inside editor:', insideEditor);
        if (!insideEditor) {
            console.log('Selection is not inside the editor.');
            if (editorRef.current) {
                const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ol>';
                try {
                    document.execCommand('insertHTML', false, html);
                    console.log('insertHTML fallback used.');
                } catch {
                    editorRef.current.innerHTML += html;
                    console.log('innerHTML fallback used.');
                }
            }
            return;
        }
        // If selection is inside a list already, do nothing
        node = sel.anchorNode;
        while (node && node !== document.body) {
            if (node.nodeName === 'UL' || node.nodeName === 'OL') {
                console.log('Already inside a list.');
                return;
            }
            node = node.parentNode;
        }
        // Try insertHTML at caret
        const html = type === 'ul' ? '<ul><li>&nbsp;</li></ul>' : '<ol><li>&nbsp;</li></ul>';
        try {
            document.execCommand('insertHTML', false, html);
            console.log('insertHTML at caret used.');
        } catch {
            // Fallback to range.insertNode
            const list = document.createElement(type);
            const li = document.createElement('li');
            li.innerHTML = '&nbsp;';
            list.appendChild(li);
            range.deleteContents();
            range.insertNode(list);
            console.log('List inserted at caret (range.insertNode fallback).');
        }
        // Move caret into the new list item
        setTimeout(() => {
            const sel2 = window.getSelection();
            if (!sel2) return;
            const editor = editorRef.current;
            if (!editor) return;
            const li = editor.querySelector(type + ' > li');
            if (li) {
                const newRange = document.createRange();
                newRange.setStart(li, 0);
                newRange.collapse(true);
                sel2.removeAllRanges();
                sel2.addRange(newRange);
                console.log('Caret moved into new list item.');
            }
        }, 0);
        // Focus editor after insertion
        if (editorRef && editorRef.current) editorRef.current.focus();
        // Trigger input event to update state
        if (editorRef && editorRef.current) {
            const event = new Event('input', { bubbles: true });
            editorRef.current.dispatchEvent(event);
        }
    }

    // Helper to check if caret is in an empty <li>
    function isCaretInEmptyListItem() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return false;
        const node = sel.anchorNode;
        if (!node) return false;
        let li: HTMLElement | null = null;
        if (node.nodeType === 3 && node.parentElement && node.parentElement.tagName === 'LI') {
            li = node.parentElement;
        } else if (node.nodeType === 1 && (node as HTMLElement).tagName === 'LI') {
            li = node as HTMLElement;
        }
        if (li && li.textContent?.replace(/\u00A0|\s/g, '') === '') {
            return li;
        }
        return false;
    }

    // Enhanced onKeyDown for editor
    const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Fallback: Ctrl+Shift+8 for bullet, Ctrl+Shift+7 for number list
        if (e.ctrlKey && e.shiftKey && e.key === '8') {
            console.log('Shortcut: Ctrl+Shift+8 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ul');
        }
        if (e.ctrlKey && e.shiftKey && e.key === '7') {
            console.log('Shortcut: Ctrl+Shift+7 pressed'); // DEBUG
            e.preventDefault();
            insertCustomList('ol');
        }
        // Exit list on Enter in empty <li>
        if (e.key === 'Enter') {
            const li = isCaretInEmptyListItem();
            if (li) {
                e.preventDefault();
                const ulOrOl = li.parentElement;
                if (!ulOrOl) return;
                const p = document.createElement('p');
                p.innerHTML = '<br>';
                ulOrOl.parentElement?.insertBefore(p, ulOrOl.nextSibling);
                // Remove the empty li
                if ('remove' in li) (li as HTMLElement).remove();
                // If list is now empty, remove it
                if (ulOrOl.children.length === 0) ulOrOl.remove();
                // Move caret to new paragraph
                const sel = window.getSelection();
                if (sel) {
                    const range = document.createRange();
                    range.setStart(p, 0);
                    range.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(range);
                }
                // Trigger input event
                if (editorRef.current) {
                    const event = new Event('input', { bubbles: true });
                    editorRef.current.dispatchEvent(event);
                }
            }
        }
    };

    function handleIndent() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { return; }
        let node = sel.anchorNode;
        let li: HTMLElement | null = null;
        while (node) {
            if (node.nodeType === 1 && (node as HTMLElement).tagName === 'LI') { li = node as HTMLElement; break; }
            node = node.parentNode;
        }
        if (!li) {
            // Not in a list: insert a tab character at caret
            const range = sel.getRangeAt(0);
            const tabNode = document.createTextNode('\u00A0\u00A0');
            range.insertNode(tabNode);
            // Move caret after the tab
            range.setStartAfter(tabNode);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            if (editorRef.current) editorRef.current.focus();
            return;
        }
        // Check if we can indent by moving to a sublist
        const parentList = li.parentElement;
        if (!parentList) { return; }
        const listType = parentList.nodeName.toLowerCase();
        let prevLi: HTMLElement | null = null;
        if ('previousElementSibling' in li && (li as HTMLElement).previousElementSibling) {
            prevLi = (li as HTMLElement).previousElementSibling as HTMLElement;
        }
        if (prevLi) {
            let sublist = prevLi.querySelector(listType);
            if (!sublist) {
                sublist = document.createElement(listType);
                prevLi.appendChild(sublist);
            }
            sublist.appendChild(li);
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            return;
        }
    }

    function handleOutdent() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) { return; }
        let node = sel.anchorNode;
        let li: HTMLElement | null = null;
        while (node) {
            if (node.nodeType === 1 && (node as HTMLElement).tagName === 'LI') { li = node as HTMLElement; break; }
            node = node.parentNode;
        }
        if (!li) { return; }
        const parentList = li.parentElement;
        const grandList = parentList?.parentElement;
        if (parentList && (grandList?.nodeName === 'UL' || grandList?.nodeName === 'OL')) {
            grandList.parentElement?.insertBefore(li, grandList.nextSibling);
            if (parentList.children.length === 0) parentList.remove();
            const range = document.createRange();
            range.setStart(li, 0);
            range.collapse(true);
            if (editorRef.current) editorRef.current.focus();
            sel.removeAllRanges();
            sel.addRange(range);
            const event = new Event('input', { bubbles: true });
            if (editorRef.current) editorRef.current.dispatchEvent(event);
        } else {
            return;
        }
    }

    // Add image insert handler
    function handleImageInsert(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            const src = ev.target?.result;
            if (typeof src === 'string' && editorRef.current) {
                const img = document.createElement('img');
                img.src = src;
                img.alt = file.name;
                img.style.margin = '0.5em 1em 0.5em 0';
                img.style.border = '2.5px solid #6366f1';
                img.style.borderRadius = '0.5rem';
                img.style.cursor = 'grab';
                img.setAttribute('contenteditable', 'false');
                img.draggable = false;

                img.onload = function() {
                    const maxWidth = editorRef.current ? Math.min(480, editorRef.current.offsetWidth * 0.6) : 480;
                    if (img.naturalWidth > maxWidth) {
                        const scale = maxWidth / img.naturalWidth;
                        img.width = Math.round(img.naturalWidth * scale);
                        img.height = Math.round(img.naturalHeight * scale);
                    } else {
                        img.width = img.naturalWidth;
                        img.height = img.naturalHeight;
                        img.style.width = img.naturalWidth + 'px';
                        img.style.height = img.naturalHeight + 'px';
                    }
                };

                const wrapper = document.createElement('span');
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';
                wrapper.className = 'docedit-img-wrapper';
                wrapper.style.background = 'none';
                wrapper.appendChild(img);
                img.style.border = '2.5px solid #6366f1';
                img.style.boxShadow = '0 0 0 2px #818cf8, 0 0 12px 2px #a78bfa66';
                img.style.background = 'none';
                wrapper.style.border = 'none';
                wrapper.style.background = 'none';
                wrapper.style.boxShadow = 'none';
                makeImageInteractive(img, wrapper);

                // Only insert if selection is inside the editor, otherwise append to editor
                let inserted = false;
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    const range = sel.getRangeAt(0);
                    let node = sel.anchorNode;
                    let insideEditor = false;
                    while (node) {
                        if (node === editorRef.current) { insideEditor = true; break; }
                        node = node.parentNode;
                    }
                    if (insideEditor) {
                        range.collapse(false);
                        range.insertNode(wrapper);
                        // Insert a zero-width space after the wrapper if it's at the end
                        if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                            const zwsp = document.createTextNode('\u200B');
                            if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                        }
                        // Move caret after image (and zwsp)
                        if (wrapper.nextSibling) {
                            range.setStartAfter(wrapper.nextSibling);
                        } else {
                            range.setStartAfter(wrapper);
                        }
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        inserted = true;
                    }
                }
                if (!inserted) {
                    editorRef.current.appendChild(wrapper);
                    // Insert a zero-width space after if at end
                    if (!wrapper.nextSibling || (wrapper.nextSibling.nodeType === 3 && wrapper.nextSibling.textContent === '')) {
                        const zwsp = document.createTextNode('\u200B');
                        if (wrapper.parentNode) wrapper.parentNode.insertBefore(zwsp, wrapper.nextSibling);
                    }
                }
                // Trigger input event
                const event = new Event('input', { bubbles: true });
                editorRef.current.dispatchEvent(event);

                // Make wrapper fit image exactly
                wrapper.style.display = 'inline-block';
                wrapper.style.position = 'relative';
                wrapper.style.width = 'fit-content';
                wrapper.style.height = 'fit-content';
                wrapper.style.padding = '0';
                wrapper.style.margin = '0';

                // Make image block-level so wrapper fits tightly
                img.style.display = 'block';

                // Add handles as children of wrapper, absolutely positioned relative to wrapper (which matches image)
                const cornerHandle = document.createElement('span');
                cornerHandle.className = 'docedit-img-resize-corner';
                cornerHandle.style.position = 'absolute';
                cornerHandle.style.right = '15px'; // move further left into the image
                cornerHandle.style.bottom = '6px';
                cornerHandle.style.width = '18px';
                cornerHandle.style.height = '18px';
                cornerHandle.style.background = 'linear-gradient(135deg, #818cf8 60%, #fff 100%)';
                cornerHandle.style.border = '2.5px solid #6366f1';
                cornerHandle.style.borderRadius = '0 0 0.75rem 0';
                cornerHandle.style.cursor = 'nwse-resize';
                cornerHandle.style.zIndex = '10';
                cornerHandle.title = 'Resize (proportional)';
                cornerHandle.style.display = 'none';
                wrapper.appendChild(cornerHandle);

                // Only make handles non-editable, not the wrapper
                // Remove or comment out:
                // wrapper.setAttribute('contenteditable', 'false');
                // wrapper.style.userSelect = 'none';
                // wrapper.setAttribute('draggable', 'false');
                // wrapper.tabIndex = -1;
                // Keep these for handles only:
                cornerHandle.setAttribute('contenteditable', 'false');
                cornerHandle.style.userSelect = 'none';
                cornerHandle.setAttribute('draggable', 'false');
                cornerHandle.tabIndex = -1;

                // MutationObserver to auto-fix accidental splitting of wrapper
                if (editorRef.current) {
                    const observer = new MutationObserver(() => {
                        // If wrapper is split, merge it back
                        if (wrapper.parentNode && wrapper.childNodes.length > 1) {
                            const imgs = wrapper.querySelectorAll('img');
                            if (imgs.length === 1 && wrapper.childNodes.length > 3) {
                                // Remove any accidental text nodes or elements between handles and image
                                [...wrapper.childNodes].forEach(node => {
                                    if (node !== img && node !== cornerHandle && wrapper.contains(node)) wrapper.removeChild(node);
                                });
                            }
                        }
                    });
                    observer.observe(wrapper, { childList: true, subtree: true });
                }

                // Show handles on hover/focus
                wrapper.onmouseenter = () => {
                    cornerHandle.style.display = 'block';
                };
                wrapper.onmouseleave = () => {
                    cornerHandle.style.display = 'none';
                };
                img.onfocus = () => {
                    cornerHandle.style.display = 'block';
                };
                img.onblur = () => {
                    cornerHandle.style.display = 'none';
                };

                // Proportional resize (corner)
                let startX = 0, startY = 0, startWidth = 0, startHeight = 0, aspect = 1, resizing = false;
                function setImgSize(w: number, h: number) {
                    img.width = w;
                    img.height = h;
                    img.style.width = w + 'px';
                    img.style.height = h + 'px';
                }
                cornerHandle.addEventListener('mousedown', function(e: MouseEvent) {
                    e.preventDefault();
                    e.stopPropagation();
                    resizing = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    startY = e.clientY;
                    startWidth = img.width || img.naturalWidth;
                    startHeight = img.height || img.naturalHeight;
                    aspect = startWidth / startHeight;
                    document.body.style.userSelect = 'none';
                    function onMouseMove(ev: MouseEvent) {
                        if (!resizing) return;
                        const dx = ev.clientX - startX;
                        let newWidth = Math.max(40, startWidth + dx);
                        let newHeight = Math.max(40, newWidth / aspect);
                        setImgSize(newWidth, newHeight);
                    }
                    function onMouseUp() {
                        resizing = false;
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('mouseup', onMouseUp);
                        document.body.style.userSelect = '';
                    }
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                });
    }

    // --- Autosave recovery modal handlers ---
    const handleOpenAutosave = async (filename: string) => {
    setRecoveringAutosave(filename);
    try {
      const res = await fetch(`${API_BASE}/files/download/${encodeURIComponent(filename)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load autosave file');
      const text = await res.text();
      setEditorHtml(text);
      if (editorRef.current) {
        editorRef.current.innerHTML = text;
      }
      // Set the current file name to the original file (strip .havdoc_auto)
      const baseName = filename.replace(/\.havdoc_auto$/, '');
      setCurrentServerFilename(baseName + '.havdoc');
      setShowAutosaveRecoveryModal(false);
      setRecoveringAutosave(null);
      setIsEmpty(!text || text.trim() === '');
      setAutosaveToastMsg('Autosave loaded!');
      setShowAutosaveToast(true);
      setTimeout(() => setShowAutosaveToast(false), 1500);
    } catch (err) {
      setRecoveringAutosave(null);
      alert('Failed to open autosave file.');
    }
  };

  const handleSaveAsAutosave = async (filename: string) => {
    setRecoveringAutosave(filename);
    try {
      const res = await fetch(`${API_BASE}/files/download/${encodeURIComponent(filename)}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load autosave file');
      const text = await res.text();
      const baseName = filename.replace(/\.havdoc_auto$/, '');
      let newName = prompt('Save autosave as (without extension):', baseName);
      if (!newName) { setRecoveringAutosave(null); return; }
      newName = newName.trim();
      if (!newName.endsWith('.havdoc')) newName += '.havdoc';
      const blob = new Blob([text], { type: 'text/plain' });
      const formData = new FormData();
      formData.append('file', blob, newName);
      const uploadRes = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!uploadRes.ok) throw new Error('Failed to save file');
      setAutosaveToastMsg('Autosave saved as new file!');
      setShowAutosaveToast(true);
      setTimeout(() => setShowAutosaveToast(false), 1500);
      await fetchServerFiles();
      setShowAutosaveRecoveryModal(false);
      setRecoveringAutosave(null);
    } catch (err) {
      setRecoveringAutosave(null);
      alert('Failed to save autosave as new file.');
    }
  };

  const handleDeleteAutosave = async (filename: string) => {
    setRecoveringAutosave(filename);
    try {
      const res = await fetch(`${API_BASE}/files/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete autosave file');
      setAutosaveToastMsg('Autosave deleted!');
      setShowAutosaveToast(true);
      setTimeout(() => setShowAutosaveToast(false), 1200);
      setAutosaveFiles(files => files.filter(f => f !== filename));
      if (autosaveFiles.length === 1) setShowAutosaveRecoveryModal(false);
      setRecoveringAutosave(null);
    } catch (err) {
      setRecoveringAutosave(null);
      alert('Failed to delete autosave file.');
    }
  };

    // Add this function before the return statement:
    function handleLoadDocument(e: React.ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function(ev) {
        try {
          let text = ev.target?.result as string;
          if (text.startsWith('HAVDOCv1')) {
            text = text.replace(/^HAVDOCv1\n/, '');
          }
          let doc: any = null;
          let isJson = true;
          try {
            doc = JSON.parse(text);
          } catch {
            isJson = false;
          }
          if (isJson && doc && typeof doc.html === 'string') {
            if (editorRef.current) {
              editorRef.current.innerHTML = doc.html;
              setEditorHtml(doc.html); // for saving later
              setCurrentLocalFilename(file.name); // Track local file name
              setCurrentServerFilename(null); // Clear server file state
              setCurrentAutosaveFilename(null);
              setTimeout(() => {
                rehydrateEditor();
                checkEmpty();
                toastSave('Document loaded!');
              }, 0);
            }
          } else if (!isJson && typeof text === 'string' && text.trim().length > 0) {
            // Fallback: treat as plain HTML
            if (editorRef.current) {
              editorRef.current.innerHTML = text;
              setEditorHtml(text);
              setCurrentLocalFilename(file.name);
              setCurrentServerFilename(null);
              setCurrentAutosaveFilename(null);
              setTimeout(() => {
                rehydrateEditor();
                checkEmpty();
                toastSave('Plain HTML loaded!');
              }, 0);
            }
          } else {
            toast('Invalid or empty document file.');
          }
        } catch (err) {
          toast('Failed to load document.');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    }

    // Render the editor and toolbar
    return (
        <div className="min-h-screen bg-gray-800 text-white flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center">
                <div className="relative w-full max-w-5xl h-full flex-1 flex flex-col mt-12 mb-12">
                    {/* Gradient outline wrapper */}
                    <div className="gradient-outline rounded-xl h-full flex-1 flex flex-col">
                        <div className="bg-gray-700 rounded-xl shadow-2xl flex flex-col h-full flex-1">
                            {/* Toolbar ...existing code... */}
                            <div className="editor-toolbar flex items-center bg-gray-900 rounded-t-xl px-6 py-3 border-b border-gray-600 shadow-md sticky top-0 z-10 text-base gap-2 flex-wrap min-h-[3.5rem]">
                                <div className="flex gap-1 items-center">
                                    <button type="button" title="Undo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('undo')}>
                                        <span className="material-symbols-outlined">undo</span>
                                    </button>
                                    <button type="button" title="Redo" className="toolbar-btn toolbar-icon" onClick={() => runCommand('redo')}>
                                        <span className="material-symbols-outlined">redo</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <select
                                        className="toolbar-btn toolbar-dropdown bg-gray-800 border border-gray-600 text-white rounded font-semibold"
                                        value={blockType}
                                        onChange={e => {
                                            setBlockType(e.target.value);
                                            runCommand('formatBlock', e.target.value);
                                        }}
                                        title="Block type"
                                    >
                                        {BLOCK_TYPES.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Bulleted List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertUnorderedList')}>
                                        <span className="material-symbols-outlined">format_list_bulleted</span>
                                    </button>
                                    <button type="button" title="Numbered List" className="toolbar-btn toolbar-icon" onClick={() => runCommand('insertOrderedList')}>
                                        <span className="material-symbols-outlined">format_list_numbered</span>
                                    </button>
                                    <button type="button" title="Outdent" className="toolbar-btn toolbar-icon" onClick={handleOutdent}>
                                        <span className="material-symbols-outlined">format_indent_decrease</span>
                                    </button>
                                    <button type="button" title="Indent" className="toolbar-btn toolbar-icon" onClick={handleIndent}>
                                        <span className="material-symbols-outlined">format_indent_increase</span>
                                    </button>
                                </div>
                                <div className="flex gap-1 items-center border-l border-gray-600 pl-3 ml-3">
                                    <button type="button" title="Link" className="toolbar-btn toolbar-icon" onClick={handleLink}>
                                        <span className="material-symbols-outlined">link</span>
                                    </button>
                                    <button type="button" title="Unlink" className="toolbar-btn toolbar-icon" onClick={() => runCommand('unlink')}>
                                        <span className="material-symbols-outlined">link_off</span>
                                    </button>
                                </div>
                                {/* Save & Extras group at far right */}
                                <div className="flex gap-2 ml-auto items-center relative">
  {currentServerFilename && (
    <span style={{ color: '#a5b4fc', fontWeight: 600, marginRight: 12, fontSize: '1.05em' }}>
      Editing: {currentServerFilename}
    </span>
  )}
  {/* Load Button with Dropdown */}
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <button
      ref={loadBtnRef}
      type="button"
      className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
      style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
      onClick={() => setShowLoadDropdown(v => !v)}
      onBlur={() => setTimeout(() => setShowLoadDropdown(false), 150)}
    >
      Load
      <span className="material-symbols-outlined ml-2" style={{ fontSize: '1.2em', verticalAlign: 'middle' }}>expand_more</span>
    </button>
    <div className={`docedit-dropdown-menu${showLoadDropdown ? ' show' : ''}`} style={{ right: 0 }}>
      <button className="docedit-dropdown-item" onClick={() => { setShowLoadDropdown(false); fileInputRef.current?.click(); }}>Local</button>
      <button className="docedit-dropdown-item" onClick={async () => { setShowLoadDropdown(false); setShowFileManager(true); await fetchServerFiles(); }}>Load from Server</button>
    </div>
    <input
      type="file"
      accept=".havdoc"
      ref={fileInputRef}
      style={{ display: 'none' }}
      onChange={handleLoadDocument}
      title="Load local document"
    />
  </div>
  {/* Save Button with Dropdown */}
  <div style={{ position: 'relative', display: 'inline-block' }}>
    <button
      ref={saveBtnRef}
      type="button"
      className="toolbar-btn font-bold px-5 py-2 rounded-lg text-white transition-all duration-200 border-2 border-transparent bg-gray-800 save-btn-gradient"
      style={{ minWidth: '5.5rem', fontSize: '1.1rem' }}
      onClick={() => setShowSaveDropdown(v => !v)}
      onBlur={() => setTimeout(() => setShowSaveDropdown(false), 150)}
    >
      Save
      <span className="material-symbols-outlined ml-2" style={{ fontSize: '1.2em', verticalAlign: 'middle' }}>expand_more</span>
    </button>
    <div className={`docedit-dropdown-menu${showSaveDropdown ? ' show' : ''}`} style={{ right: 0 }}>
      <button className="docedit-dropdown-item" onClick={() => { setShowSaveDropdown(false); saveDocument(); }}>Local</button>
      <button className="docedit-dropdown-item" onClick={async () => { setShowSaveDropdown(false); await saveDocumentToServer(); }}>Database</button>
      <div className="docedit-dropdown-item flex items-center gap-2" style={{ cursor: 'pointer' }} onClick={() => setAutosaveEnabled(v => !v)}>
    <input type="checkbox" checked={autosaveEnabled} readOnly className="mr-2" />
    Autosave (server doc)
  </div>
    </div>
  </div>
  <div className="relative">
                                        <button
                                            ref={extrasBtnRef}
                                            type="button"
                                            className="toolbar-btn toolbar-icon"
                                            title="Extras"
                                            onClick={() => setShowExtras(e => !e)}
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>
                                        {showExtras && createPortal(
                                            <div
                                                ref={extrasMenuRef}
                                                className="fixed w-56 bg-gray-800 border border-gray-700 rounded shadow-lg z-[999999] docedit-extras-menu"
                                                style={{
                                                    top: extrasBtnRef.current?.getBoundingClientRect().bottom + 4, // Removed window.scrollY
                                                    left: extrasBtnRef.current?.getBoundingClientRect().right - 224, // Removed window.scrollX
                                                }}
                                            >
                                                {/* Insert Image at the very top of the extras menu */}
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item flex items-center gap-2"
                                                    onClick={() => {
                                                        setShowExtras(false);
                                                        setTimeout(() => imageInputRef.current?.click(), 100);
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined align-middle mr-2">image</span>
                                                    Insert Image
                                                </button>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item docedit-clear-btn flex items-center gap-2"
                                                    onClick={handleClearEditor}
                                                    style={{ fontWeight: 700 }}
                                                >
                                                    <span className="material-symbols-outlined align-middle mr-2">delete</span>
                                                    Clear Document
                                                </button>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <b>B</b>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <i>I</i>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                <button
                                                type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <u>U</u>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                                                                                            <button
                                                    type="button"
                                                    className="w-full text-left px-4 py-2 toolbar-btn menu-item text-gray-400 flex items-center gap-2"
                                                    onClick={() => toast('coming soon')}
                                                >
                                                    <s>S</s>
                                                    <span className="text-xs ml-2">(Coming Soon)</span>
                                                </button>
                                            </div>,
                                            document.body
                                        )}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            ref={imageInputRef}
                                            style={{ display: 'none' }}
                                            onChange={handleImageInsert}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Editor area and placeholder wrapper */}
                            <div style={{position: 'relative', flex: 1, minHeight: '600px', display: 'flex', flexDirection: 'column'}}>
                                <div
                                    ref={editorRef}
                                    className="flex-1 flex flex-col p-10 text-lg outline-none bg-transparent document-editor markdown-body text-white h-full"
                                    contentEditable
                                    suppressContentEditableWarning
                                    spellCheck={true}
                                    aria-label="Document editor"
                                    onFocus={() => setIsFocused(true)}
                                    onBlur={() => setIsFocused(false)}
                                    onInput={handleEditorInput}
                                    style={{flex:1, minHeight:'0'}}
                                    onKeyDown={e => {
                                        if (e.key === 'Tab') {
                                            e.preventDefault();
                                            if (e.shiftKey) {
                                                handleOutdent();
                                            } else {
                                                handleIndent();
                                            }
                                        }
                                        handleEditorKeyDown(e);
                                    }}
                                />
                                {/* Overlay placeholder, absolutely positioned over the editor area */}
                                {isEmpty && !isFocused && (
                                    <span className="editor-placeholder" style={{
                                        position: 'absolute',
                                        left: '2.5rem',
                                        top: '2.5rem',
                                        zIndex: 10,
                                        userSelect: 'none',
                                        pointerEvents: 'none',
                                        color: '#9ca3af',
                                        fontSize: '1rem',
                                        transition: 'opacity 0.15s'
                                    }}>
                                        Start your document...
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Loader overlay and fade-in logic remain unchanged */}
            {showLoader && (
                <div className="fixed inset-0 flex items-center justify-center bg-gray-800 z-50 transition-opacity duration-500 opacity-100">
                    <span className="loader" aria-label="Loading" />
                </div>
            )}
            {/* --- Close extras menu on outside click --- */}
            {showExtras && (
                <div
                    className="fixed inset-0 z-50"
                    onMouseDown={e => {
                        const menu = extrasMenuRef.current;
                        const btn = extrasBtnRef.current;
                        if (
                            menu && !menu.contains(e.target as Node) &&
                            btn && !btn.contains(e.target as Node)
                        ) {
                            setShowExtras(false);
                        }
                    }}
                />
            )}
            {/* --- File manager modal --- */}
            {showFileManager && (
                <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black bg-opacity-60">
    <div className="bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-md relative">
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl"
        onClick={() => setShowFileManager(false)}
        aria-label="Close file manager"
      >
        ×
      </button>
      <h2 className="text-xl font-bold mb-4 text-white">Load a File from Server</h2>
      {loadingFiles ? (
        <div className="text-gray-300">Loading files...</div>
      ) : fileError ? (
        <div className="text-red-400 mb-2">{fileError}</div>
      ) : serverFiles.length === 0 ? (
        <div className="text-gray-400">No files found.</div>
      ) : (
        <ul className="divide-y divide-gray-700">
          {serverFiles.map(f => (
            <li key={f} className="py-2 flex items-center justify-between">
              <span className="text-gray-200">{f}</span>
              <button
                className="ml-4 px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-500 text-white text-sm font-semibold"
                onClick={() => handleServerFileLoad(f)}
              >
                Load
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  </div>
            )}
            {/* Autosave toast notification */}
{showAutosaveToast && (
  <div style={{ position: 'fixed', top: '1.5rem', right: '2rem', zIndex: 9999999, background: 'rgba(34,197,94,0.98)', color: '#fff', padding: '0.6em 1.4em', borderRadius: '0.6em', fontWeight: 600, fontSize: '1.08em', boxShadow: '0 2px 12px 0 #22c55e44', transition: 'opacity 0.2s' }}>
    {autosaveToastMsg}
  </div>
)}
{/* Autosave recovery modal */}
{showAutosaveRecoveryModal && (
  <div className="fixed inset-0 z-[9999999] flex items-center justify-center bg-black bg-opacity-60">
    <div className="bg-gray-900 rounded-lg shadow-lg p-6 w-full max-w-lg relative">
      <button
        className="absolute top-2 right-2 text-gray-400 hover:text-white text-2xl"
        onClick={() => setShowAutosaveRecoveryModal(false)}
        aria-label="Close autosave recovery"
      >×</button>
      <h2 className="text-xl font-bold mb-4 text-white">Unsaved Autosave Files Found</h2>
      <div className="mb-2 text-gray-300">You have unsaved autosave files. You can open, save, delete, or ignore them.</div>
      <ul className="divide-y divide-gray-700">
        {autosaveFiles.map(f => (
          <li key={f} className="py-2 flex items-center justify-between gap-2">
            <span className="text-gray-200 break-all">{f}</span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 rounded bg-indigo-700 hover:bg-indigo-500 text-white text-sm font-semibold"
                disabled={recoveringAutosave === f}
                onClick={() => handleOpenAutosave(f)}
              >Open</button>
              <button
                className="px-3 py-1 rounded bg-green-700 hover:bg-green-500 text-white text-sm font-semibold"
                disabled={recoveringAutosave === f}
                onClick={() => handleSaveAsAutosave(f)}
              >Save As</button>
              <button
                className="px-3 py-1 rounded bg-red-700 hover:bg-red-500 text-white text-sm font-semibold"
                disabled={recoveringAutosave === f}
                onClick={() => handleDeleteAutosave(f)}
              >Delete</button>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-4 text-right">
        <button
          className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white font-semibold"
          onClick={() => setShowAutosaveRecoveryModal(false)}
        >Dismiss</button>
      </div>
    </div>
  </div>
)}
        </div>
    );
}

// --- Autosave recovery modal handlers ---
const handleOpenAutosave = async (filename: string) => {
  setRecoveringAutosave(filename);
  try {
    const res = await fetch(`${API_BASE}/files/download/${encodeURIComponent(filename)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load autosave file');
    const text = await res.text();
    setEditorHtml(text);
    if (editorRef.current) {
      editorRef.current.innerHTML = text;
    }
    // Set the current file name to the original file (strip .havdoc_auto)
    const baseName = filename.replace(/\.havdoc_auto$/, '');
    setCurrentServerFilename(baseName + '.havdoc');
    setShowAutosaveRecoveryModal(false);
    setRecoveringAutosave(null);
    setIsEmpty(!text || text.trim() === '');
    setAutosaveToastMsg('Autosave loaded!');
    setShowAutosaveToast(true);
    setTimeout(() => setShowAutosaveToast(false), 1500);
  } catch (err) {
    setRecoveringAutosave(null);
    alert('Failed to open autosave file.');
  }
};

const handleSaveAsAutosave = async (filename: string) => {
  setRecoveringAutosave(filename);
  try {
    const res = await fetch(`${API_BASE}/files/download/${encodeURIComponent(filename)}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to load autosave file');
    const text = await res.text();
    const baseName = filename.replace(/\.havdoc_auto$/, '');
    let newName = prompt('Save autosave as (without extension):', baseName);
    if (!newName) { setRecoveringAutosave(null); return; }
    newName = newName.trim();
    if (!newName.endsWith('.havdoc')) newName += '.havdoc';
    const blob = new Blob([text], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, newName);
    const uploadRes = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    if (!uploadRes.ok) throw new Error('Failed to save file');
    setAutosaveToastMsg('Autosave saved as new file!');
    setShowAutosaveToast(true);
    setTimeout(() => setShowAutosaveToast(false), 1500);
    await fetchServerFiles();
    setShowAutosaveRecoveryModal(false);
    setRecoveringAutosave(null);
  } catch (err) {
    setRecoveringAutosave(null);
    alert('Failed to save autosave as new file.');
  }
};

const handleDeleteAutosave = async (filename: string) => {
    setRecoveringAutosave(filename);
    try {
      const res = await fetch(`${API_BASE}/files/delete/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete autosave file');
      setAutosaveToastMsg('Autosave deleted!');
      setShowAutosaveToast(true);
      setTimeout(() => setShowAutosaveToast(false), 1200);
      setAutosaveFiles(files => files.filter(f => f !== filename));
      if (autosaveFiles.length === 1) setShowAutosaveRecoveryModal(false);
      setRecoveringAutosave(null);
    } catch (err) {
      setRecoveringAutosave(null);
      alert('Failed to delete autosave file.');
    }
  };
