import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslations } from "@util/translations";
import Message from "@widgets/Message";
import DataUsageIcon from "@mui/icons-material/DataUsage";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import CancelIcon from "@mui/icons-material/Cancel";
import Tooltip from "@mui/material/Tooltip";
import { Divider } from '@mui/material';

export default function Statistics({ group, open, onClose, sessions }) {
    const translations = useTranslations();
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!open || !group || !sessions) {
            return;
        }
        setLoading(true);
        const loadStats = async () => {
            try {
                let total = 0;
                let ai = 0;
                let standard = 0;
                let overviews = 0;

                const groupSessions = sessions.filter(session => session.group === group.name);

                if (groupSessions) {
                    for (const session of groupSessions) {
                        total++;

                        if (session.name.endsWith(" - AI")) {
                            ai++;
                        } else if (session.name.startsWith("Overview - ")) {
                            overviews++;
                        } else {
                            standard++;
                        }
                    }
                }

                setStats({
                    total,
                    ai,
                    standard,
                    overviews
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [open, group, sessions]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--app-bar-background)" }}>
                <b>{group.name[0].toUpperCase() + group.name.slice(1)}</b> {translations.STATISTICS}
                <Tooltip title={translations.CLOSE} arrow>
                    <IconButton onClick={onClose} size="large">
                        <CancelIcon />
                    </IconButton>
                </Tooltip>
            </DialogTitle>
            <Divider />
            <DialogContent>
                {loading && <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />}
                {!loading && stats && (
                    <TableContainer>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell>{translations.SESSIONS}</TableCell>
                                    <TableCell align="right">{stats.total}</TableCell>
                                </TableRow>
                                <TableRow sx={{ '& td, & th': { border: 0 } }}>
                                    <TableCell>Standard</TableCell>
                                    <TableCell align="right">{stats.standard}</TableCell>
                                </TableRow>
                                <TableRow sx={{ '& td, & th': { border: 0 } }}>
                                    <TableCell>Overview</TableCell>
                                    <TableCell align="right">{stats.overviews}</TableCell>
                                </TableRow>
                                <TableRow sx={{ '& td, & th': { border: 0 } }}>
                                    <TableCell>AI</TableCell>
                                    <TableCell align="right">{stats.ai}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DialogContent>
        </Dialog >
    );
}
