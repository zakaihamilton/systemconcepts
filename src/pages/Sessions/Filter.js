import React from "react";
import { SessionsStore } from "@util/sessions";
import { useTranslations } from "@util/translations";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import AudioIcon from "@icons/Audio";
import MovieIcon from "@mui/icons-material/Movie";
import InsertPhotoOutlinedIcon from "@mui/icons-material/InsertPhotoOutlined";
import MovieFilterIcon from "@mui/icons-material/MovieFilter";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";

export default function Filter() {
    const translations = useTranslations();
    const { showFilterDialog, typeFilter, yearFilter, sessions } = SessionsStore.useState();

    const handleClose = () => {
        SessionsStore.update(s => {
            s.showFilterDialog = false;
        });
    };

    const toggleType = (id) => {
        SessionsStore.update(s => {
            const filter = s.typeFilter || [];
            if (filter.includes(id)) {
                s.typeFilter = filter.filter(name => name !== id);
            } else {
                s.typeFilter = [...filter, id];
            }
        });
    };

    const toggleYear = (year) => {
        SessionsStore.update(s => {
            const filter = s.yearFilter || [];
            if (filter.includes(year)) {
                s.yearFilter = filter.filter(y => y !== year);
            } else {
                s.yearFilter = [...filter, year];
            }
        });
    };

    const years = (sessions || [])?.reduce((acc, session) => {
        if (session.year && !acc.includes(session.year)) {
            acc.push(session.year);
        }
        return acc;
    }, [])?.sort((a, b) => String(b).localeCompare(String(a)));

    const types = [
        { id: "audio", name: translations.AUDIO, icon: <AudioIcon /> },
        { id: "video", name: translations.VIDEO, icon: <MovieIcon /> },
        { id: "image", name: translations.IMAGE, icon: <InsertPhotoOutlinedIcon /> },
        { id: "overview", name: translations.OVERVIEW, icon: <MovieFilterIcon /> },
        { id: "ai", name: translations.AI, icon: <AutoAwesomeIcon /> }
    ];

    return (
        <Dialog open={showFilterDialog} onClose={handleClose} fullWidth maxWidth="xs">
            <DialogTitle>{translations.FILTER}</DialogTitle>
            <DialogContent>
                <Typography variant="subtitle1" gutterBottom>{translations.TYPE}</Typography>
                <Stack direction="row" flexWrap="wrap" gap={1} mb={2}>
                    {types.map(type => (
                        <Chip
                            key={type.id}
                            label={type.name}
                            icon={type.icon}
                            onClick={() => toggleType(type.id)}
                            color={typeFilter.includes(type.id) ? "primary" : "default"}
                            variant={typeFilter.includes(type.id) ? "filled" : "outlined"}
                            clickable
                        />
                    ))}
                </Stack>
                {years && years.length > 0 && (
                    <>
                        <Typography variant="subtitle1" gutterBottom>{translations.YEAR}</Typography>
                        <Stack direction="row" flexWrap="wrap" gap={1}>
                            {years.map(year => (
                                <Chip
                                    key={year}
                                    label={year}
                                    onClick={() => toggleYear(year)}
                                    color={yearFilter.includes(year) ? "primary" : "default"}
                                    variant={yearFilter.includes(year) ? "filled" : "outlined"}
                                    clickable
                                />
                            ))}
                        </Stack>
                    </>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>{translations.CLOSE}</Button>
            </DialogActions>
        </Dialog>
    );
}
