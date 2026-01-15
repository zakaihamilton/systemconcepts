import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from '@util/translations';
import Controls from './Player/Controls';

export default function Player({ contentRef, onParagraphChange }) {
    const translations = useTranslations();
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentParagraphIndex, setCurrentParagraphIndex] = useState(-1);
    const [paragraphs, setParagraphs] = useState([]);
    const [voices, setVoices] = useState([]);
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [voiceMenuAnchor, setVoiceMenuAnchor] = useState(null);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const utteranceRef = useRef(null);
    const synthRef = useRef(null);

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
            const pElements = contentRef.current.querySelectorAll('[data-paragraph-index]');
            const extracted = Array.from(pElements).map((el, index) => {
                // Extract text from the rendered DOM to get translated glossary terms
                // Clone the element to manipulate it without affecting the display
                const clone = el.cloneNode(true);

                // Remove the paragraph number element
                const paragraphNumber = clone.querySelector('[class*="paragraphNumber"]');
                if (paragraphNumber) {
                    paragraphNumber.remove();
                }

                // Get text from glossary-main-text spans (the translated terms)
                // and regular text, excluding annotations
                const annotations = clone.querySelectorAll('[class*="glossary-annotation"]');
                annotations.forEach(ann => ann.remove());

                const text = clone.textContent.trim();

                return {
                    element: el,
                    text: text,
                    index: parseInt(el.getAttribute('data-paragraph-index'), 10) || index
                };
            });
            setParagraphs(extracted);
        };

        extractParagraphs();

        // Re-extract if content changes
        const observer = new MutationObserver(extractParagraphs);
        observer.observe(contentRef.current, { childList: true, subtree: true });

        return () => observer.disconnect();
    }, [contentRef]);

    // Speak a specific paragraph
    const speakParagraph = useCallback((index, autoPlay = true) => {
        console.log('speakParagraph called:', index, autoPlay);
        if (!synthRef.current || !paragraphs[index]) return;

        // Invalidate current utterance to prevent onend from firing for the cancelled utterance
        utteranceRef.current = null;

        // Cancel any ongoing speech
        synthRef.current.cancel();

        const paragraph = paragraphs[index];

        // Update selection and scroll
        setCurrentParagraphIndex(index);
        if (onParagraphChange) {
            // Pass the actual data-paragraph-index value, not the array index
            onParagraphChange(paragraph.index, paragraph.element);
        }
        paragraph.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Only play if autoPlay is true
        if (!autoPlay) {
            setIsPlaying(false);
            return;
        }

        const utterance = new SpeechSynthesisUtterance(paragraph.text);

        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        // Apply selected voice
        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utterance.onstart = () => {
            // Only update state if this is still the active utterance
            if (utteranceRef.current === utterance) {
                setIsPlaying(true);
            }
        };

        utterance.onend = () => {
            console.log('onend fired for utterance');
            // Only proceed if this is the active utterance
            if (utteranceRef.current === utterance) {
                console.log('onend: proceeding to next paragraph');
                // Auto-advance to next paragraph
                if (index < paragraphs.length - 1) {
                    speakParagraph(index + 1, true);
                } else {
                    setIsPlaying(false);
                }
            } else {
                console.log('onend: ignoring cancelled utterance');
            }
        };

        utterance.onerror = (event) => {
            // Ignore interrupted errors as they happen when we manually cancel/stop
            if (event.error === 'interrupted' || event.error === 'canceled') {
                return;
            }
            console.error('Speech synthesis error:', event);
            if (utteranceRef.current === utterance) {
                setIsPlaying(false);
            }
        };

        utteranceRef.current = utterance;
        synthRef.current.speak(utterance);
    }, [paragraphs, onParagraphChange, selectedVoice]);

    // Play/Resume
    const handlePlay = useCallback(() => {
        if (!synthRef.current) return;

        // precise check: if we are paused OR (speaking but not reported as paused which can happen)
        if (synthRef.current.paused || synthRef.current.speaking) {
            synthRef.current.resume();
            setIsPlaying(true);
        } else {
            const startIndex = currentParagraphIndex >= 0 ? currentParagraphIndex : 0;
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

    // Stop
    const handleStop = useCallback(() => {
        console.log('handleStop called');
        if (synthRef.current) {
            // Clear reference before cancelling to prevent onend logic
            utteranceRef.current = null;

            // Aggressive stop: resume -> cancel -> double check
            synthRef.current.resume();
            synthRef.current.cancel();

            // Double tap cancel for stubborn browsers
            setTimeout(() => {
                if (synthRef.current) {
                    synthRef.current.resume();
                    synthRef.current.cancel();
                }
            }, 10);

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

    // Previous paragraph
    const handlePrevious = useCallback(() => {
        const prevIndex = Math.max(0, currentParagraphIndex - 1);
        speakParagraph(prevIndex, false);
    }, [currentParagraphIndex, speakParagraph]);

    // Next paragraph
    const handleNext = useCallback(() => {
        const nextIndex = Math.min(paragraphs.length - 1, currentParagraphIndex + 1);
        speakParagraph(nextIndex, false);
    }, [currentParagraphIndex, paragraphs.length, speakParagraph]);

    // Expose method to start from specific paragraph (called from paragraph clicks)
    useEffect(() => {
        const handleParagraphClick = (event) => {
            const target = event.target.closest('[data-paragraph-index]');
            if (!target) return;

            const index = parseInt(target.getAttribute('data-paragraph-index'), 10);
            const paragraphIndex = paragraphs.findIndex(p => p.index === index);

            if (paragraphIndex >= 0) {
                // If currently playing, jump to the paragraph and play
                // Otherwise, just select it
                speakParagraph(paragraphIndex, isPlaying);
            }
        };

        const content = contentRef?.current;
        if (content) {
            content.addEventListener('click', handleParagraphClick);
            return () => content.removeEventListener('click', handleParagraphClick);
        }
    }, [contentRef, paragraphs, speakParagraph, isPlaying]);

    // Restart playback with new voice when voice changes during playback
    const isInitialMount = useRef(true);

    useEffect(() => {
        // Skip on initial mount
        if (isInitialMount.current) {
            isInitialMount.current = false;
            return;
        }

        if (isPlaying && currentParagraphIndex >= 0 && selectedVoice) {
            // Cancel current speech and restart with new voice
            if (synthRef.current) {
                console.log('Voice changed, restarting playback...');
                // No need for setTimeout here, speakParagraph handles cancellation
                speakParagraph(currentParagraphIndex, true);
            }
        }
    }, [selectedVoice, isPlaying, currentParagraphIndex, speakParagraph]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (synthRef.current) {
                utteranceRef.current = null; // Clear ref before cancelling
                synthRef.current.cancel();
            }
        };
    }, []);

    if (paragraphs.length === 0) return null;

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
