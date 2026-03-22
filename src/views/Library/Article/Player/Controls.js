
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Tooltip from '@mui/material/Tooltip';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import StopIcon from '@mui/icons-material/Stop';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Typography from '@mui/material/Typography';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import styles from './Controls.module.scss';

export default function Controls({
    translations,
    isPlaying,
    currentParagraphIndex,
    paragraphs,
    voices,
    selectedVoice,
    voiceMenuAnchor,
    isCollapsed,
    setIsCollapsed,
    handlePrevious,
    handlePlay,
    handlePause,
    handleStop,
    handleNext,
    handleVoiceMenuOpen,
    handleVoiceMenuClose,
    handleVoiceSelect
}) {
    const voiceTooltip = <span className={styles.voiceTooltip}><b> Voice</b>{selectedVoice?.name || ''}</span>;
    return (
        <>
            <Paper
                className={`${styles.root} ${!isCollapsed ? styles.expanded : ''} ${isCollapsed ? styles.collapsed : ''} ${isPlaying ? styles.playing : ''} print-hidden`}
                elevation={0}
            >
                <Box className={styles.controls} role="group" aria-label="Player controls">
                    {!isCollapsed && (
                        <>
                            <Tooltip title={translations.PREVIOUS_PARAGRAPH} arrow>
                                <span>
                                    <IconButton
                                        onClick={handlePrevious}
                                        disabled={currentParagraphIndex <= 0}
                                        className={styles.controlButton}
                                        aria-label={translations.PREVIOUS_PARAGRAPH}
                                    >
                                        <SkipPreviousIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            {!isPlaying ? (
                                <Tooltip title={translations.PLAY} arrow>
                                    <IconButton
                                        onClick={handlePlay}
                                        className={`${styles.controlButton} ${styles.playButton}`}
                                        aria-label={translations.PLAY}
                                    >
                                        <PlayArrowIcon />
                                    </IconButton>
                                </Tooltip>
                            ) : (
                                <Tooltip title={translations.PAUSE} arrow>
                                    <IconButton
                                        onClick={handlePause}
                                        className={`${styles.controlButton} ${styles.playButton}`}
                                        aria-label={translations.PAUSE}
                                    >
                                        <PauseIcon />
                                    </IconButton>
                                </Tooltip>
                            )}

                            <Tooltip title={translations.STOP} arrow>
                                <span>
                                    <IconButton
                                        onClick={handleStop}
                                        disabled={!isPlaying && currentParagraphIndex < 0}
                                        className={styles.controlButton}
                                        aria-label={translations.STOP}
                                    >
                                        <StopIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <Tooltip title={translations.NEXT_PARAGRAPH} arrow>
                                <span>
                                    <IconButton
                                        onClick={handleNext}
                                        disabled={currentParagraphIndex >= paragraphs.length - 1}
                                        className={styles.controlButton}
                                        aria-label={translations.NEXT_PARAGRAPH}
                                    >
                                        <SkipNextIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <Tooltip title={voiceTooltip} arrow>
                                <IconButton
                                    onClick={handleVoiceMenuOpen}
                                    className={styles.controlButton}
                                    aria-label="Select voice"
                                >
                                    <RecordVoiceOverIcon />
                                </IconButton>
                            </Tooltip>

                            <Menu
                                anchorEl={voiceMenuAnchor}
                                open={Boolean(voiceMenuAnchor)}
                                onClose={handleVoiceMenuClose}
                                slotProps={{
                                    paper: {
                                        style: {
                                            maxHeight: 300,
                                            width: '300px',
                                        },
                                    }
                                }}
                                sx={{
                                    '& .MuiPaper-root': {
                                        borderRadius: 3,
                                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                                        '@media (prefers-color-scheme: dark)': {
                                            backgroundColor: 'rgba(40, 40, 45, 0.98)',
                                            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                                        }
                                    }
                                }}
                                aria-label="Available voices"
                            >
                                {voices
                                    .filter(voice => voice.lang.startsWith('en-'))
                                    .map((voice, index) => (
                                        <MenuItem
                                            key={index}
                                            onClick={() => handleVoiceSelect(voice)}
                                            selected={selectedVoice?.name === voice.name}
                                            aria-label={`Select ${voice.name}`}
                                            sx={{
                                                py: 1.5,
                                                '&.Mui-selected': {
                                                    backgroundColor: 'rgba(25, 118, 210, 0.12)',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(25, 118, 210, 0.2)',
                                                    },
                                                    '@media (prefers-color-scheme: dark)': {
                                                        backgroundColor: 'rgba(255, 255, 255, 0.15)',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(255, 255, 255, 0.22)',
                                                        }
                                                    }
                                                },
                                                '@media (prefers-color-scheme: dark)': {
                                                    color: 'rgba(255, 255, 255, 0.95)',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                                    }
                                                }
                                            }}
                                        >
                                            <Typography variant="body2" sx={{ fontWeight: selectedVoice?.name === voice.name ? 600 : 400 }}>
                                                {voice.name}
                                            </Typography>
                                        </MenuItem>
                                    ))}
                            </Menu>

                            <Tooltip title={translations.COLLAPSE} arrow>
                                <IconButton
                                    onClick={() => setIsCollapsed(true)}
                                    className={styles.controlButton}
                                    size="small"
                                    aria-label={translations.COLLAPSE}
                                >
                                    <ExpandMoreIcon />
                                </IconButton>
                            </Tooltip>
                        </>
                    )}
                </Box>
            </Paper>

            {/* Collapse/Expand button on the right side */}
            {isCollapsed && (
                <Button
                    variant="text"
                    onClick={() => setIsCollapsed(false)}
                    className={`${styles.expandButton} print-hidden`}
                    size="small"
                >
                    {translations.PLAYER}
                </Button>
            )}
        </>
    );
}
