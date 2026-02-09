import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from '@util/translations';
import { useLocalStorage } from '@util/hooks';
import Controls from './Player/Controls';
import { LibraryTagKeys } from '../Icons';

export default function Player({ contentRef, onParagraphChange, selectedTag, currentParagraphIndex: externalParagraphIndex }) {
    const translations = useTranslations();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentParagraphIndex, setCurrentParagraphIndex] = useState(-1);
    const [paragraphs, setParagraphs] = useState([]);

    // Sync external logical index to internal array index
    useEffect(() => {
        let timeoutId;
        if (paragraphs.length > 0 && externalParagraphIndex !== undefined) {
            const index = paragraphs.findIndex(p => p.index === externalParagraphIndex);
            if (index !== -1) {
                timeoutId = setTimeout(() => {
                    setCurrentParagraphIndex(prev => (prev !== index ? index : prev));
                }, 0);
            }
        }
        return () => clearTimeout(timeoutId);
    }, [externalParagraphIndex, paragraphs]);

    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [voiceMenuAnchor, setVoiceMenuAnchor] = useState(null);
    const [isCollapsed, setIsCollapsed] = useLocalStorage("playerCollapsed", false);

    const utteranceRef = useRef(null);
    const synthRef = useRef(null);
    const isInitialMount = useRef(true);

    const prevVoiceRef = useRef(null);
    const isStoppingRef = useRef(false);

    // Initialize speech synthesis and load voices
    useEffect(() => {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            if (!synthRef.current) {
                synthRef.current = window.speechSynthesis;
            }

            const loadVoices = () => {
                const availableVoices = synthRef.current.getVoices();
                setVoices(availableVoices);

                if (availableVoices.length > 0 && !selectedVoice) {
                    // Try to load from local storage first
                    const storedVoiceName = localStorage.getItem('tts-voice-name');
                    let preferredVoice = null;

                    if (storedVoiceName) {
                        preferredVoice = availableVoices.find(v => v.name === storedVoiceName);
                    }

                    if (!preferredVoice) {
                        // Prioritize: Google UK English Male > Google UK English > any English voice > first available
                        preferredVoice =
                            availableVoices.find(v => v.name === 'Google UK English Male') ||
                            availableVoices.find(v => v.name === 'Google UK English') ||
                            availableVoices.find(v => v.lang.startsWith('en-')) ||
                            availableVoices[0];
                    }

                    setSelectedVoice(preferredVoice);
                }
            };

            loadVoices();

            // Add event listener for when voices are loaded asynchronously
            if (synthRef.current.onvoiceschanged !== undefined) {
                synthRef.current.onvoiceschanged = loadVoices;
            }

            return () => {
                if (synthRef.current) {
                    synthRef.current.onvoiceschanged = null;
                }
            };
        }
    }, [selectedVoice]);

    // Extract paragraphs from content
    useEffect(() => {
        if (!contentRef?.current) return;

        const extractParagraphs = () => {
            const result = [];

            // Prepend title and tags as virtual paragraphs
            if (selectedTag) {
                // Build title text (find the most specific tag value)
                let titleText = '';
                for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
                    const key = LibraryTagKeys[i];
                    const value = selectedTag[key];
                    if (value && String(value).trim()) {
                        titleText = value;
                        break;
                    }
                }

                // Add title as first virtual paragraph
                if (titleText) {
                    const numberPrefix = selectedTag.number ? `Number ${selectedTag.number}. ` : '';
                    result.push({
                        element: null, // Virtual paragraph has no element
                        text: `${numberPrefix}${titleText}`,
                        index: -2, // Special index for title
                        isVirtual: true,
                        type: 'title'
                    });
                }

                // Build tags text (collect all tag values except the title)
                const tagTexts = [];
                for (let i = LibraryTagKeys.length - 1; i >= 0; i--) {
                    const key = LibraryTagKeys[i];
                    const value = selectedTag[key];
                    if (value && String(value).trim() && value !== titleText) {
                        const label = key.charAt(0).toUpperCase() + key.slice(1);
                        tagTexts.push(`${label}: ${value}`);
                    }
                }

                // Add tags as second virtual paragraph
                if (tagTexts.length > 0) {
                    result.push({
                        element: null,
                        text: tagTexts.join('. '),
                        index: -3, // Special index for tags
                        isVirtual: true,
                        type: 'tags'
                    });
                }
            }

            const pElements = contentRef.current.querySelectorAll('[data-paragraph-index]');
            const extracted = Array.from(pElements).map((el, index) => {
                const text = el.getAttribute('data-paragraph-text') || el.textContent.trim();
                return {
                    element: el,
                    text: text,
                    index: parseInt(el.getAttribute('data-paragraph-index'), 10) || index,
                    isVirtual: false
                };
            });

            result.push(...extracted);
            setParagraphs(result);
        };

        extractParagraphs();

        const observer = new MutationObserver(extractParagraphs);
        observer.observe(contentRef.current, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [contentRef, selectedTag]);

    // Speak a specific paragraph
    const speakParagraphRef = useRef(null);
    const speakParagraph = useCallback((index, autoPlay = true) => {
        // 1. Guard against interactions while stopping
        if (isStoppingRef.current) return;
        if (!synthRef.current || !paragraphs[index]) return;

        // 2. Clear the specific reference to block old 'onend' events
        utteranceRef.current = null;

        // 3. CANCEL IMMEDIATELY (Crucial step)
        synthRef.current.cancel();

        const paragraph = paragraphs[index];

        // 4. Update UI State immediately
        setCurrentParagraphIndex(index);
        if (onParagraphChange) {
            onParagraphChange(paragraph.index, paragraph.element);
        }
        // Only scroll into view for non-virtual paragraphs
        if (paragraph.element) {
            paragraph.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        // 5. Handle "Pause" mode (just stop and exit)
        if (!autoPlay) {
            setIsPlaying(false);
            return;
        }

        // 6. Setup the new utterance
        const utterance = new SpeechSynthesisUtterance(paragraph.text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
            if (utteranceRef.current === utterance && !isStoppingRef.current) {
                setIsPlaying(true);
            }
        };

        utterance.onend = () => {
            if (utteranceRef.current === utterance && !isStoppingRef.current) {
                if (index < paragraphs.length - 1) {
                    if (speakParagraphRef.current) {
                        speakParagraphRef.current(index + 1, true);
                    }
                } else {
                    setIsPlaying(false);
                }
            }
        };

        utterance.onerror = (event) => {
            if (event.error === 'interrupted' || event.error === 'canceled') return;
            console.error('Speech synthesis error:', event);
            if (utteranceRef.current === utterance) {
                setIsPlaying(false);
            }
        };

        // 7. ASSIGN REF NOW (Before the timeout)
        // This claims "ownership" of the player. 
        // If another click happens during the 50ms wait, this ref will change, 
        // and the timeout below will know to abort.
        utteranceRef.current = utterance;

        // 8. INTRODUCE DELAY
        // This 50ms gap ensures the browser processes the .cancel() command 
        // completely before receiving the new .speak() command.
        setTimeout(() => {
            // Only speak if this utterance is STILL the chosen one
            if (utteranceRef.current === utterance && !isStoppingRef.current) {
                synthRef.current.speak(utterance);
            }
        }, 50);

    }, [paragraphs, onParagraphChange, selectedVoice]);

    useEffect(() => {
        speakParagraphRef.current = speakParagraph;
    }, [speakParagraph]);

    // Play/Resume
    const handlePlay = useCallback(() => {
        if (!synthRef.current) return;
        isStoppingRef.current = false; // Reset stop flag on explicit play

        if (synthRef.current.paused || synthRef.current.speaking) {
            synthRef.current.resume();
            setIsPlaying(true);
        } else {
            // Default to 0 (Title/First paragraph in array) if no paragraph is selected
            const startIndex = currentParagraphIndex !== -1 ? currentParagraphIndex : 0;
            speakParagraph(startIndex);
        }
    }, [currentParagraphIndex, speakParagraph]);

    // Pause
    const handlePause = useCallback(() => {
        if (synthRef.current && synthRef.current.speaking) {
            synthRef.current.pause();
            setIsPlaying(false);
        }
    }, []);

    // Stop (FIXED)
    const handleStop = useCallback(() => {
        isStoppingRef.current = true; // Block any pending restarts

        if (synthRef.current) {
            // Clear reference immediately
            utteranceRef.current = null;

            // Aggressive stop
            synthRef.current.resume();
            synthRef.current.cancel();

            // Double check cleanup
            setTimeout(() => {
                if (synthRef.current) {
                    utteranceRef.current = null;
                    synthRef.current.cancel();
                }
                isStoppingRef.current = false; // Release lock after cleanup
            }, 50);

            setIsPlaying(false);
            setCurrentParagraphIndex(-1);
            if (onParagraphChange) {
                onParagraphChange(-1, null);
            }
        }
    }, [onParagraphChange]);

    // Voice menu handlers
    const handleVoiceMenuOpen = (event) => {
        setVoiceMenuAnchor(event.currentTarget);
    };

    const handleVoiceMenuClose = () => {
        setVoiceMenuAnchor(null);
    };

    const handleVoiceSelect = (voice) => {
        setSelectedVoice(voice);
        localStorage.setItem('tts-voice-name', voice.name);
        handleVoiceMenuClose();
    };

    // Inside Player component

    const handlePrevious = useCallback(() => {
        const prevIndex = Math.max(0, currentParagraphIndex - 1);
        // Pass 'isPlaying' instead of 'false' to maintain playback state
        speakParagraph(prevIndex, isPlaying);
    }, [currentParagraphIndex, speakParagraph, isPlaying]);

    const handleNext = useCallback(() => {
        const nextIndex = Math.min(paragraphs.length - 1, currentParagraphIndex + 1);
        // Pass 'isPlaying' instead of 'false'
        speakParagraph(nextIndex, isPlaying);
    }, [currentParagraphIndex, paragraphs.length, speakParagraph, isPlaying]);

    // Expose method to start from specific paragraph


    // Restart playback when voice changes (FIXED)
    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            prevVoiceRef.current = selectedVoice;
            return;
        }

        const hasVoiceChanged = prevVoiceRef.current !== selectedVoice;

        // Only restart if:
        // 1. We are playing
        // 2. The voice ACTUALLY changed (not just paragraphs updating)
        // 3. We are not currently stopping
        if (isPlaying && currentParagraphIndex >= 0 && selectedVoice && hasVoiceChanged && !isStoppingRef.current) {
            console.log('Voice changed, restarting playback...');
            setTimeout(() => speakParagraph(currentParagraphIndex, true), 0);
        }

        prevVoiceRef.current = selectedVoice;
    }, [selectedVoice, isPlaying, currentParagraphIndex, speakParagraph]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (synthRef.current) {
                utteranceRef.current = null;
                synthRef.current.cancel();
            }
        };
    }, []);

    if (paragraphs.length === 0 || voices.length === 0) return null;

    return (
        <Controls
            translations={translations}
            isPlaying={isPlaying}
            currentParagraphIndex={currentParagraphIndex}
            paragraphs={paragraphs}
            voices={voices}
            selectedVoice={selectedVoice}
            voiceMenuAnchor={voiceMenuAnchor}
            isCollapsed={isCollapsed}
            setIsCollapsed={setIsCollapsed}
            handlePrevious={handlePrevious}
            handlePlay={handlePlay}
            handlePause={handlePause}
            handleStop={handleStop}
            handleNext={handleNext}
            handleVoiceMenuOpen={handleVoiceMenuOpen}
            handleVoiceMenuClose={handleVoiceMenuClose}
            handleVoiceSelect={handleVoiceSelect}
        />
    );
}