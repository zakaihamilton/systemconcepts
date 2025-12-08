import { useState, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import { useTranslations } from "@util/translations";
import storage from "@util/storage";
import { makePath, fileTitle } from "@util/path";
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

export default function Statistics({ group, open, onClose }) {
    const translations = useTranslations();
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (!open || !group) {
            return;
        }
        setLoading(true);
        const loadStats = async () => {
            try {
                const basePath = "shared/sessions";
                const years = await storage.getListing(makePath("local", basePath, group.name));

                let totalSessions = 0;
                let aiSessions = 0;
                let nonAiSessions = 0;

                if (years) {
                    for (const year of years) {
                        const files = await storage.getListing(makePath("local", basePath, group.name, year.name));
                        if (!files) continue;

                        const sessionFilesMap = {};
                        for (const file of files) {
                            let id = fileTitle(file.name);
                            // Handle resolution suffix for video files
                            const resolutionMatch = id.match(/(.*)_(\d+x\d+)/);
                            if (resolutionMatch) {
                                id = resolutionMatch[1];
                            }
                            if (!sessionFilesMap[id]) {
                                sessionFilesMap[id] = [];
                            }
                            sessionFilesMap[id].push(file);
                        }

                        for (const id of Object.keys(sessionFilesMap)) {
                            const match = id.trim().match(/(\d+-\d+-\d+)\ (.*)/);
                            if (!match) continue;
                            const [, , name] = match;

                            totalSessions++;

                            if (name.endsWith(" - AI") || name.startsWith("Overview - ")) {
                                aiSessions++;
                            } else {
                                nonAiSessions++;
                            }
                        }
                    }
                }

                setStats({
                    totalSessions,
                    aiSessions,
                    nonAiSessions
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        loadStats();
    }, [open, group]);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            fullWidth
            maxWidth="xs"
        >
            <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {translations.STATISTICS}
                <IconButton onClick={onClose} size="large">
                    <Tooltip title={translations.CLOSE} arrow>
                        <CancelIcon />
                    </Tooltip>
                </IconButton>
            </DialogTitle>
            <DialogContent>
                {loading && <Message animated={true} Icon={DataUsageIcon} label={translations.LOADING + "..."} />}
                {!loading && stats && (
                    <TableContainer>
                        <Table>
                            <TableBody>
                                <TableRow>
                                    <TableCell>{translations.SESSIONS}</TableCell>
                                    <TableCell align="right">{stats.totalSessions}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>AI</TableCell>
                                    <TableCell align="right">{stats.aiSessions}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <TableCell>Non-AI</TableCell>
                                    <TableCell align="right">{stats.nonAiSessions}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </DialogContent>
        </Dialog>
    );
}
