import { AudioFile, CreateNewFolder, Delete, DragIndicator, DriveFileMove, Edit, FilterAlt, Folder, MoreVert, PlaylistAdd, Search, UploadFile } from "@mui/icons-material";
import { Autocomplete, Box, Breadcrumbs, Button, Card, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, IconButton, InputBase, InputLabel, LinearProgress, ListItemIcon, ListItemText, Menu, MenuItem, MenuList, Select, SxProps, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { DirectoryItem, InfiniteQuery, SearchedItem } from "../types/storage";
import { DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent, pointerWithin, useDraggable, useDroppable } from "@dnd-kit/core";
import { InfiniteData, UseInfiniteQueryResult, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiService, createQueryFn, isError } from "../services/apiService";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { APP_KEY } from "../config";
import { BaseTheme } from "@mui/material/styles/createThemeNoVars";
import { Modal } from "@owlbear-rodeo/sdk/lib/types/Modal";
import OBR from "@owlbear-rodeo/sdk";
import { Track } from "../types/tracks";
import { useContextMenu } from "../hooks";

// eslint-disable-next-line react-refresh/only-export-components
export const manageTracksModal: Modal = {
    id: `${APP_KEY}/manage-tracks`,
    url: "/manage-tracks",
    width: 1300,
    height: 800,
};

type DialogType = "add-directory" 
                | "track-details" 
                | "delete-item" 
                | "add-track" 
                | "add-track-from-drag" 
                | "bulk-add-tracks" 
                | "rename-directory"
                | "edit-playlists"
                | "filter"
                | "search-results"
                ;

interface SelectedItemType {
    id: number;
    type: DirectoryItem["type"];
}

function isSameItem(item1: SelectedItemType, item2: SelectedItemType) {
    return item1.id === item2.id && item1.type === item2.type;
}

function directoryItemToString(item: SelectedItemType, capitalize: boolean = false) {
    let str = item.type.toLocaleLowerCase();
    if (capitalize) {
        str = str.charAt(0).toLocaleUpperCase() + str.slice(1);
    }
    return str;
}

function stripExtension(filename: string) {
    const split = filename.split(".");
    if (split.length == 1) {
        return filename;
    }
    return split.slice(0, -1).join(".");
}

const SIZE_UNITS = ["B", "KB", "MB", "GB"];
function displaySize(size: number | undefined): string {
    if (size == undefined) {
        return "Unknown";
    }

    let unitIndex = 0;
    let displaySize = size;

    // Convert size to the next unit while it's >= 1024 and we have more units
    while (displaySize >= 1024 && unitIndex < SIZE_UNITS.length - 1) {
        displaySize /= 1024;
        unitIndex++;
    }

    // Rule: If the displaySize is <= 1 in all units, pick "B"
    if (displaySize <= 1 && size <= 1) {
        return `${size} B`;
    }

    // Rule: If no unit results in a value < 1024, fallback to GB
    if (displaySize >= 1024) {
        return `${(size / 1_073_741_824).toFixed(2)} GB`;
    }

    return `${displaySize.toFixed(2)} ${SIZE_UNITS[unitIndex]}`;
}

function getItemStyle(selected: boolean): SxProps<BaseTheme> {
    return {
        userSelect: "none",
        cursor: "pointer",
        position: "relative",
        borderRadius: 4,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        borderColor: selected ? "primary.main" : undefined,
        "&:hover": {
            borderColor: "primary.main",
            boxShadow: (theme) =>
                `0 0 0 1.5px ${theme.palette.primary.main}`,
        },
        p: 3,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        overflow: "visible",
        maxWidth: 250
    };
}

function DragCountBox({ count } : { count: number }) {
    return <Box
        sx={{
            position: "absolute",
            top: -8,
            right: -8,
            backgroundColor: "primary.main",
            color: "white",
            borderRadius: "50%",
            width: 24,
            height: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "0.75rem",
            fontWeight: "bold",
            border: "1px solid white",
            zIndex: 11
        }}
    >
        {count}
    </Box>;
}

function TrackItemElement(
    { 
        item, 
        selected,
        selectedItems,
        onContextMenu, 
        onClick, 
        onDoubleClick,
    }: { 
        item: DirectoryItem,
        selected: boolean,
        selectedItems: SelectedItemType[],
        onContextMenu: React.MouseEventHandler<HTMLDivElement>,
        onClick: React.MouseEventHandler<HTMLDivElement>,
        onDoubleClick: React.MouseEventHandler<HTMLDivElement>
    }
) {
    const { attributes, listeners, setNodeRef, active } = useDraggable({
        id: item.id,
        data: {
            itemsToDrag: selected ? selectedItems : [item as SelectedItemType]
        }
    });
    const [hovered, setHovered] = useState(false);
    const shouldHide = active?.data?.current == undefined ? false : active.data.current.itemsToDrag.some((dragged: SelectedItemType) => dragged.id == item.id);

    return <Card
        ref={setNodeRef}
        {...attributes}
        key={item.name}
        variant="outlined"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={onContextMenu}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        sx={{
            ...getItemStyle(selected), 
            opacity: shouldHide ? 0.5 : 1
        }}
    >
        <AudioFile sx={{ width: 100, height: 100 }} />
        <Typography variant="body2" textAlign="center">{item.name}</Typography>

        <DragIndicator
            {...listeners}
            sx={{
                transition: "opacity 0.2s ease",
                position: "absolute",
                top: 6,
                right: 4,
                opacity: hovered ? 1 : 0,
            }} 
        />
    </Card>;
}

function DirectoryItemElement(
    {
        item,
        selected,
        selectedItems,
        onContextMenu,
        onClick,
        onDoubleClick,
    }: {
        item: DirectoryItem,
        selected: boolean,
        selectedItems: SelectedItemType[],
        onContextMenu: React.MouseEventHandler<HTMLDivElement>,
        onClick: React.MouseEventHandler<HTMLDivElement>,
        onDoubleClick: React.MouseEventHandler<HTMLDivElement>
    }
) {
    const { attributes, listeners, setNodeRef: setDraggableNodeRef, active } = useDraggable({
        id: item.id,
        data: {
            itemsToDrag: selected ? selectedItems : [item as SelectedItemType]
        }
    });
    const { setNodeRef: setDroppableNodeRef } = useDroppable({
        id: item.id,
    });
    const [hovered, setHovered] = useState(false);
    const shouldHide = active?.data?.current == undefined ? false : active.data.current.itemsToDrag.some((dragged: SelectedItemType) => dragged.id == item.id);

    return <Card
        ref={ref => { setDraggableNodeRef(ref); setDroppableNodeRef(ref); }}
        {...attributes}
        key={item.name}
        variant="outlined"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onContextMenu={onContextMenu}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        sx={{
            ...getItemStyle(selected),
            opacity: shouldHide ? 0.5 : 1
        }}
    >
        <Folder sx={{ width: 100, height: 100 }} />
        <Typography variant="body2" textAlign="center">{item.name}</Typography>

        <DragIndicator
            {...listeners}
            sx={{
                transition: "opacity 0.2s ease",
                position: "absolute",
                top: 6,
                right: 4,
                opacity: hovered ? 1 : 0,
            }} 
        />
    </Card>;
}

function DragOverlayItem(
    { item, dragCount }: { item: DirectoryItem, dragCount: number }
) {
    return <Card
        variant="outlined"
        sx={{
            ...getItemStyle(false),
            "&:hover": undefined,
            width: 175,
            height: 175,
        }}
    >
        {item.type === "TRACK" &&
            <AudioFile sx={{ width: 100, height: 100 }} />
        }
        {item.type === "DIRECTORY" &&
            <Folder sx={{ width: 100, height: 100 }} />
        }
        <Typography variant="body2" sx={{ textAlign: "center", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden", maxWidth: "100%" }}>
            {item.name}
        </Typography>

        {dragCount > 1 && <DragCountBox count={dragCount} />}

        {
            Array(Math.max(0, Math.min(dragCount-1, 4))).fill(0).map((_, index) => (
                <Card
                    key={index}
                    variant="outlined"
                    sx={{
                        ...getItemStyle(false),
                        "&:hover": undefined,
                        position: "absolute",
                        top: (index+1) * 10,
                        left: (index+1) * 10,
                        width: 175,
                        height: 175,
                        zIndex: -index-10
                    }}
                >
                </Card>
            ))
        }
    </Card>;
}

function BreadcrumbsItem({ text, id, onClick, hovered }: { text: string, id: string, onClick: React.MouseEventHandler<HTMLSpanElement>, hovered: boolean }) {
    const { setNodeRef } = useDroppable({
        id
    });

    return <Typography
        ref={setNodeRef}
        sx={{ 
            cursor: "pointer", 
            textDecoration: "underline",
            border: "1px solid transparent",
            borderRadius: 4,
            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
            borderColor: hovered ? "primary.main" : undefined,
            pb: 0.25, pt: 0.25, pl: 1, pr: 1,
        }}
        onClick={onClick}
    >
        { text }
    </Typography>
}

function idFromString(idString: string) {
    const split = idString.split("-");
    if (split[split.length-1] == "null") {
        return null;
    }
    return parseInt(split[split.length-1]);
}

function sortDirectoryContents(item1: DirectoryItem, item2: DirectoryItem): number {
    if (item1.type == item2.type) {
        return item1.id - item2.id;
    }
    if (item1.type == "DIRECTORY") return -1;
    return 1;
}

function TrackDetailsDialog({
    closeDialog, setDetailedItem, detailedItem, handleSaveTrack, openedDialog, playlistsQueryData
}: {
    closeDialog: () => void,
    setDetailedItem: React.Dispatch<React.SetStateAction<DirectoryItem | null>>,
    detailedItem: DirectoryItem | null,
    handleSaveTrack: React.FormEventHandler,
    openedDialog: DialogType | null,
    playlistsQueryData: string[] | undefined,
}) {
    return <Dialog
        open={openedDialog == "track-details"}
        onClose={closeDialog}
        fullWidth
    >
        <DialogTitle>Track Details</DialogTitle>
        <DialogContent>
            <form onSubmit={handleSaveTrack} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <TextField
                    required
                    name="name"
                    margin="dense"
                    label="Name"
                    variant="standard"
                    value={detailedItem?.name ?? ""}
                    onChange={e => setDetailedItem(old => old ? { ...old, name: e.target.value } : null)}
                    fullWidth />
                <TextField
                    name="size"
                    margin="dense"
                    label="Size"
                    variant="standard"
                    defaultValue={detailedItem ? displaySize((detailedItem as Track).size) : ""}
                    disabled
                    fullWidth />
                <Autocomplete
                    multiple
                    options={playlistsQueryData ?? []}
                    value={detailedItem ? ((detailedItem as Track).playlists ?? []) : []}
                    onChange={(_, playlists) => setDetailedItem(old => old ? { ...old, playlists } : null)}
                    freeSolo
                    fullWidth
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Playlists"
                            placeholder="Playlists" />
                    )} />
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button type="submit">Save</Button>
                </DialogActions>
            </form>
        </DialogContent>
    </Dialog>;
}

function RenameDirectoryDialog({
    closeDialog, setContextMenuItem, contextMenuItem, handleRenameDirectory, openedDialog,
}: {
    closeDialog: () => void,
    setContextMenuItem: React.Dispatch<React.SetStateAction<DirectoryItem | null>>,
    contextMenuItem: DirectoryItem | null,
    handleRenameDirectory: React.FormEventHandler,
    openedDialog: DialogType | null,
}) {
    return <Dialog
        open={openedDialog == "rename-directory"}
        onClose={closeDialog}
        fullWidth
    >
        <DialogTitle>Rename Directory</DialogTitle>
        <DialogContent>
            <form onSubmit={handleRenameDirectory} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <TextField
                    required
                    name="name"
                    margin="dense"
                    label="Name"
                    variant="standard"
                    value={contextMenuItem?.name ?? ""}
                    onChange={e => setContextMenuItem(old => old ? { ...old, name: e.target.value } : null)}
                    fullWidth />
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button type="submit">Rename</Button>
                </DialogActions>
            </form>
        </DialogContent>
    </Dialog>;
}

function DeleteItemsDialog({
    closeDialog, itemsToDelete, handleDeleteItems, openedDialog,
}: {
    closeDialog: () => void,
    itemsToDelete: SelectedItemType[],
    handleDeleteItems: (items: SelectedItemType[]) => void,
    openedDialog: DialogType | null,
}) {
    return <Dialog
        open={openedDialog == "delete-item"}
        onClose={closeDialog}
    >
        <DialogTitle>Delete {itemsToDelete.length == 1 ? directoryItemToString(itemsToDelete[0], true) : "Items"}</DialogTitle>
        <DialogContent>
            <DialogContentText>
                Are you sure you want to delete {itemsToDelete.length == 1 ? "this" : "these"} {itemsToDelete.length == 1 ? directoryItemToString(itemsToDelete[0]) : "items"}?
                This action cannot be undone.
            </DialogContentText>
            <DialogActions>
                <Button onClick={closeDialog}>Cancel</Button>
                <Button onClick={() => handleDeleteItems(itemsToDelete)}>Delete</Button>
            </DialogActions>
        </DialogContent>
    </Dialog>;
}

function AddTrackDialog({
    closeDialog, filename, handleAddTrack, openedDialog, playlistsQueryData
}: {
    closeDialog: () => void,
    filename: string | undefined,
    handleAddTrack: React.FormEventHandler,
    openedDialog: DialogType | null,
    playlistsQueryData: string[] | undefined,
}) {
    const [playlistsToAdd, setPlaylistsToAdd] = useState<string[]>([]);

    return <Dialog
        open={openedDialog == "add-track"}
        onClose={closeDialog}
    >
        <DialogTitle>Add Track</DialogTitle>
        <DialogContent>
            <DialogContentText>
                To add a new track, upload a file, give it a name, and click "Add".
            </DialogContentText>
            <form onSubmit={handleAddTrack}>
                <TextField
                    autoFocus
                    required
                    name="name"
                    margin="dense"
                    label="Track Name"
                    variant="standard"
                    defaultValue={stripExtension(filename ?? "")}
                    fullWidth />
                <TextField
                    required
                    name="source"
                    margin="dense"
                    label="Source file"
                    variant="standard"
                    slotProps={{ htmlInput: { accept: "audio/*" } }}
                    type="file"
                    fullWidth />
                <Box sx={{ p: 1 }} />
                <Autocomplete
                    multiple
                    options={playlistsQueryData ?? []}
                    freeSolo
                    fullWidth
                    value={playlistsToAdd}
                    onChange={(_, playlists) => setPlaylistsToAdd(playlists)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Playlists"
                            placeholder="Playlists" />
                    )} />
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button type="submit">Add</Button>
                </DialogActions>
            </form>
        </DialogContent>
    </Dialog>;
}

function AddTrackFromDragDialog({
    closeDialog, filename, handleAddTrack, openedDialog, playlistsQueryData
}: {
    closeDialog: () => void,
    filename: string | undefined,
    handleAddTrack: React.FormEventHandler,
    openedDialog: DialogType | null,
    playlistsQueryData: string[] | undefined,
}) {
    const [playlistsToAdd, setPlaylistsToAdd] = useState<string[]>([]);

    return <Dialog
        open={openedDialog == "add-track-from-drag"}
        onClose={closeDialog}
    >
        <DialogTitle>Add Track</DialogTitle>
        <DialogContent>
            <DialogContentText>
                To add a new track, give it a name and click "Add".
            </DialogContentText>
            <form onSubmit={handleAddTrack}>
                <TextField
                    autoFocus
                    required
                    name="name"
                    margin="dense"
                    label="Track Name"
                    variant="standard"
                    defaultValue={stripExtension(filename ?? "")}
                    fullWidth />
                <Box sx={{ p: 1 }} />
                <Autocomplete
                    multiple
                    options={playlistsQueryData ?? []}
                    freeSolo
                    fullWidth
                    value={playlistsToAdd}
                    onChange={(_, playlists) => setPlaylistsToAdd(playlists)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Playlists"
                            placeholder="Playlists" />
                    )} />
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button type="submit">Add</Button>
                </DialogActions>
            </form>
        </DialogContent>
    </Dialog>;
}

function AddDirectory({
    closeDialog, handleCreateDirectory, openedDialog
}: {
    closeDialog: () => void,
    handleCreateDirectory: React.FormEventHandler,
    openedDialog: DialogType | null,
}) {
    return <Dialog
        open={openedDialog == "add-directory"}
        onClose={closeDialog}
    >
        <DialogTitle>Create Directory</DialogTitle>
        <DialogContent>
            <DialogContentText>
                To create a directory, give it a name and click "Create".
            </DialogContentText>
            <form onSubmit={handleCreateDirectory}>
                <TextField
                    autoFocus
                    required
                    name="name"
                    margin="dense"
                    label="Directory Name"
                    variant="standard"
                    fullWidth />
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button type="submit">Create</Button>
                </DialogActions>
            </form>
        </DialogContent>
    </Dialog>;
}

function FilterDialog({
    closeDialog, openedDialog, playlistsQueryData, playlistsToFilter, setPlaylistsToFilter, filterPlaylists, setFilterPlaylists
}: {
    closeDialog: () => void,
    handleAddTrack: React.FormEventHandler,
    openedDialog: DialogType | null,
    playlistsQueryData: string[] | undefined,
    playlistsToFilter: string[],
    setPlaylistsToFilter: React.Dispatch<React.SetStateAction<string[]>>,
    filterPlaylists: boolean,
    setFilterPlaylists: React.Dispatch<React.SetStateAction<boolean>>,
}) {
    return <Dialog
        open={openedDialog == "filter"}
        onClose={closeDialog}
    >
        <DialogTitle>Filter</DialogTitle>
        <DialogContent>
            <DialogContentText>Edit search filters. If playlist filtering is selected but no playlists are, only tracks without an assigned playlist will be shown.</DialogContentText>
            <Box sx={{ p: 1 }} />
            <Box sx={{ display: "flex", flexDirection: "row", gap: 1, alignItems: "center" }}>
                <InputLabel>Filter Playlists</InputLabel>
                <Checkbox 
                    checked={filterPlaylists}
                    onChange={(_, checked) => setFilterPlaylists(checked)}
                />
            </Box>
            <Box sx={{ p: 1 }} />
            <Autocomplete
                multiple
                options={playlistsQueryData ?? []}
                freeSolo
                fullWidth
                disabled={!filterPlaylists}
                value={playlistsToFilter}
                onChange={(_, playlists) => setPlaylistsToFilter(playlists)}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Playlists"
                        placeholder="Playlists" />
                )} 
            />
        </DialogContent>
    </Dialog>;
}

function BulkAddTracksDialog({
    closeDialog, openedDialog, fileUploadProgress
}: {
    closeDialog: () => void,
    handleAddTrack: React.FormEventHandler,
    openedDialog: DialogType | null,
    fileUploadProgress: number,
}) {
    return <Dialog
        open={openedDialog == "bulk-add-tracks"}
        onClose={closeDialog}
    >
        <DialogTitle>Adding Tracks</DialogTitle>
        <DialogContent>
            <DialogContentText>
                Your tracks are currently uploading, please wait...
            </DialogContentText>
            <LinearProgress variant="determinate" value={fileUploadProgress} />
            <DialogActions>
                <Button onClick={closeDialog}>Cancel</Button>
            </DialogActions>
        </DialogContent>
    </Dialog>;
}

function EditPlaylistsDialog({
    closeDialog, openedDialog, playlistsQueryData, editPlaylistsMenuAction, setEditPlaylistsMenuAction, handleEditPlaylists
}: {
    closeDialog: () => void,
    handleAddTrack: React.FormEventHandler,
    openedDialog: DialogType | null,
    playlistsQueryData: string[] | undefined,
    editPlaylistsMenuAction: string,
    setEditPlaylistsMenuAction: React.Dispatch<React.SetStateAction<string>>,
    handleEditPlaylists: React.FormEventHandler
}) {
    const [playlistsToAdd, setPlaylistsToAdd] = useState<string[]>([]);

    return <Dialog
        open={openedDialog == "edit-playlists"}
        onClose={closeDialog}
    >
        <DialogTitle>Edit Playlists</DialogTitle>
        <DialogContent>
            <DialogContentText>
                {editPlaylistsMenuAction === "" ?
                    "Please select an action." : null}
                {editPlaylistsMenuAction === "add" ?
                    "Select the playlists to add these tracks to, then click \"Add\"." : null}
                {editPlaylistsMenuAction === "set" ?
                    "Select a set of playlists for these tracks, then click \"Edit\"." : null}
                {editPlaylistsMenuAction === "remove" ?
                    "Select the playlists to remove these tracks from, then click \"Remove\"." : null}
            </DialogContentText>
            <form onSubmit={handleEditPlaylists}>
                <Box sx={{ p: 1 }} />
                <FormControl fullWidth>
                    <InputLabel id="label-for-action">Action</InputLabel>
                    <Select
                        labelId="label-for-action"
                        label="Action"
                        value={editPlaylistsMenuAction}
                        onChange={e => setEditPlaylistsMenuAction(e.target.value)}
                        fullWidth
                        required
                    >
                        <MenuItem value="" disabled>Select an action...</MenuItem>
                        <MenuItem value="add">Add</MenuItem>
                        <MenuItem value="set">Set</MenuItem>
                        <MenuItem value="remove">Remove</MenuItem>
                    </Select>
                </FormControl>
                <Box sx={{ p: 1 }} />
                <Autocomplete
                    multiple
                    options={playlistsQueryData ?? []}
                    freeSolo
                    fullWidth
                    value={playlistsToAdd}
                    onChange={(_, playlists) => setPlaylistsToAdd(playlists)}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="Playlists"
                            placeholder="Playlists" />
                    )} 
                />
                <DialogActions>
                    <Button onClick={closeDialog}>Cancel</Button>
                    <Button type="submit">
                        {editPlaylistsMenuAction === "add" ?
                            "Add" : null}
                        {editPlaylistsMenuAction === "set" ?
                            "Set" : null}
                        {editPlaylistsMenuAction === "remove" ?
                            "Remove" : null}
                    </Button>
                </DialogActions>
            </form>
        </DialogContent>
    </Dialog>;
}

export function PaginatedSearchTable({ 
    query, rowsPerPage, setRowsPerPage, closeDialog, navigationReplace
}: { 
    query: UseInfiniteQueryResult<InfiniteData<InfiniteQuery<SearchedItem>, unknown>, Error> ,
    rowsPerPage: number,
    setRowsPerPage: React.Dispatch<React.SetStateAction<number>>,
    closeDialog: () => void,
    navigationReplace: (id: number|null) => void,
}) {
    const [page, setPage] = useState(0);

    const loadedItems = query.data?.pages.flatMap((p) => p.data) ?? [];
    const totalCount = query.data?.pages[0]?.total ?? 0;

    useEffect(() => {
        const required = (page + 1) * rowsPerPage;
        if (loadedItems.length < required && query.hasNextPage && !query.isFetchingNextPage) {
            query.fetchNextPage();
        }
    }, [page, rowsPerPage, loadedItems.length, query]);

    if (query.isLoading) {
        return (
            <Box display="flex" justifyContent="center" my={4}>
                <CircularProgress />
            </Box>
        );
    }

    if (query.isError) {
        return <Typography color="error">Failed to load results.</Typography>;
    }

    const pageItems = loadedItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

    return (
        <>
            <Table size="small" sx={{ tableLayout: "fixed", width: "100%" }}>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ width: "75%" }}>Name</TableCell>
                        <TableCell sx={{ width: "25%" }} align="right">Size</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {pageItems.map((item) => (
                        <TableRow 
                            key={`${item.type}-${item.id}`}
                            sx={{ cursor: "pointer "}}
                            onClick={() => {
                                navigationReplace(item.directory_id);
                                closeDialog();
                            }}
                            title="Go to directory"
                        >
                            <TableCell
                                sx={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    maxWidth: 0,
                                }}
                            >
                                {item.name}
                            </TableCell>
                            <TableCell align="right">
                                {item.type === "TRACK" ? displaySize(item.size ?? 0) : "—"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>

            <TablePagination
                component="div"
                count={totalCount}
                page={page}
                onPageChange={(_, newPage) => setPage(newPage)}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={(e) => {
                    setRowsPerPage(parseInt(e.target.value, 10));
                    setPage(0);
                }}
                rowsPerPageOptions={[10, 15, 25, 50]}
            />
        </>
    );
}

function SearchResultsDialog({
    closeDialog, openedDialog, searchString, filterPlaylists, playlists, navigationReplace
}: {
    closeDialog: () => void,
    openedDialog: DialogType | null,
    searchString: string,
    filterPlaylists: boolean,
    playlists: string[],
    navigationReplace: (id: number|null) => void,
}) {
    const [paginationLimit, setPaginationLimit] = useState<number>(15);

    const fetchResults = async ({ pageParam = 0 }) => {
        const result = await apiService.searchForTracks(
            searchString,
            filterPlaylists ? playlists : null,
            pageParam * paginationLimit,
            paginationLimit
        );
        if (isError(result)) {
            throw new Error(result.error);
        }
        return result;
    };

    const resultsQuery = useInfiniteQuery({
        queryKey: ["search-results", searchString, String(filterPlaylists), ...playlists],
        initialPageParam: 0,
        queryFn: fetchResults,
        enabled: openedDialog == "search-results",
        getNextPageParam: (lastPage, allPages) => {
            if (lastPage.data.length < paginationLimit) {
                return undefined;
            }
            return allPages.length;
        },
        refetchOnWindowFocus: false,
    });

    return <Dialog
        open={openedDialog == "search-results"}
        onClose={closeDialog}
    >
        <DialogTitle>Search Results</DialogTitle>
        <DialogContent>
            <PaginatedSearchTable 
                query={resultsQuery}
                rowsPerPage={paginationLimit}
                setRowsPerPage={setPaginationLimit}
                navigationReplace={navigationReplace}
                closeDialog={closeDialog}
            />
        </DialogContent>
    </Dialog>;
}

function GlobalSelectionContextMenu({
    openDialog, contextMenuHandler, menuOptionsButtonRef, setEditPlaylistsMenuAction, setItemsToDelete, selectedItems
}: {
    openDialog: (dialog: DialogType) => void,
    menuOptionsButtonRef: React.MutableRefObject<HTMLButtonElement | null>,
    setEditPlaylistsMenuAction: React.Dispatch<React.SetStateAction<string>>,
    setItemsToDelete: React.Dispatch<React.SetStateAction<SelectedItemType[]>>,
    selectedItems: SelectedItemType[],
    contextMenuHandler: ReturnType<typeof useContextMenu>,
}) {
    return <Menu
        open={contextMenuHandler.opened}
        onClose={contextMenuHandler.close}
        anchorReference="anchorEl"
        anchorEl={menuOptionsButtonRef.current}
        anchorOrigin={{
            vertical: "top",
            horizontal: "left"
        }}
    >
        <MenuList>
            <MenuItem onClick={() => { contextMenuHandler.close(); } }>
                <ListItemIcon>
                    <DriveFileMove />
                </ListItemIcon>
                <ListItemText>
                    Move To
                </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setEditPlaylistsMenuAction("add"); openDialog("edit-playlists"); contextMenuHandler.close(); } }>
                <ListItemIcon>
                    <PlaylistAdd />
                </ListItemIcon>
                <ListItemText>
                    Edit Playlists
                </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setItemsToDelete(selectedItems); openDialog("delete-item"); contextMenuHandler.close(); } }>
                <ListItemIcon>
                    <Delete />
                </ListItemIcon>
                <ListItemText>
                    Delete All
                </ListItemText>
            </MenuItem>
        </MenuList>
    </Menu>;
}

function ItemContextMenu({
    openDialog, contextMenuHandler, setDetailedItem, setItemsToDelete, contextMenuItem
}: {
    openDialog: (dialog: DialogType) => void,
    menuOptionsButtonRef: React.MutableRefObject<HTMLButtonElement | null>,
    setDetailedItem: React.Dispatch<React.SetStateAction<DirectoryItem | null>>,
    setItemsToDelete: React.Dispatch<React.SetStateAction<SelectedItemType[]>>,
    contextMenuItem: DirectoryItem | null,
    contextMenuHandler: ReturnType<typeof useContextMenu>,
}) { 
    return <Menu
        open={contextMenuHandler.opened}
        onClose={contextMenuHandler.close}
        anchorReference="anchorPosition"
        anchorPosition={contextMenuHandler.position}
    >
        <MenuList>
            <MenuItem onClick={() => {
                setDetailedItem(contextMenuItem);
                openDialog(contextMenuItem?.type === "DIRECTORY" ? "rename-directory" : "track-details");
                contextMenuHandler.close();
            } }>
                <ListItemIcon>
                    <Edit />
                </ListItemIcon>
                <ListItemText>
                    {contextMenuItem?.type === "DIRECTORY" ? "Rename" : "Edit"}
                </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { contextMenuHandler.close(); } }>
                <ListItemIcon>
                    <DriveFileMove />
                </ListItemIcon>
                <ListItemText>
                    Move To
                </ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setItemsToDelete([contextMenuItem!]); openDialog("delete-item"); contextMenuHandler.close(); } }>
                <ListItemIcon>
                    <Delete />
                </ListItemIcon>
                <ListItemText>
                    Delete
                </ListItemText>
            </MenuItem>
        </MenuList>
    </Menu>;
}

export function ManageTracksModal() {
    const [directoryStack, setDirectoryStack] = useState<DirectoryItem[]>([]);
    const [openedDialog, setOpenedDialog] = useState<DialogType|null>(null);
    const [currentDirectory, setCurrentDirectory] = useState<number|null>(null);
    const [selectedItems, setSelectedItems] = useState<SelectedItemType[]>([]);
    const [detailedItem, setDetailedItem] = useState<DirectoryItem|null>(null);
    const [contextMenuItem, setContextMenuItem] = useState<DirectoryItem|null>(null);
    const [itemsToDelete, setItemsToDelete] = useState<SelectedItemType[]>([]);
    const [activeItem, setActiveItem] = useState<DirectoryItem|null>(null);
    const [hoveredDroppable, setHoveredDroppable] = useState<string|number|null>(null);
    const [dragCount, setDragCount] = useState(0);
    const [draggingFromDesktop, setDraggingFromDesktop] = useState(0);
    const [simpleSearchString, setSimpleSearchString] = useState("");
    const [filterPlaylists, setFilterPlaylists] = useState(false);
    const [playlistsToAdd, setPlaylistsToAdd] = useState<string[]>([]);
    const [playlistsToFilter, setPlaylistsToFilter] = useState<string[]>([]);
    const [fileToUpload, setFileToUpload] = useState<File|null>(null);
    const [fileUploadProgress, setFileUploadProgress] = useState(0);
    const [editPlaylistsMenuAction, setEditPlaylistsMenuAction] = useState("");

    const menuOptionsButtonRef = useRef<HTMLButtonElement|null>(null);
    const contextMenuHandler = useContextMenu();
    const globalContextMenuHandler = useContextMenu();

    const directoryContentsQuery = useQuery({
        queryKey: ["directory-contents", currentDirectory],
        queryFn: createQueryFn(() => apiService.getDirectoryContents(currentDirectory))
    });
    const filteredContents = useMemo(() => {
        if (directoryContentsQuery.data == undefined) return undefined;
        return directoryContentsQuery.data.filter(item => item.name.toLocaleLowerCase().includes(simpleSearchString.toLocaleLowerCase())).sort(sortDirectoryContents);
    }, [directoryContentsQuery.data, simpleSearchString]);

    const detailedTrack = useQuery({
        queryKey: ["detailed-track", detailedItem?.id, detailedItem?.type],
        queryFn: createQueryFn(() => detailedItem && detailedItem.type === "TRACK" ? apiService.getTrack(detailedItem.id) : Promise.resolve({ error: "" })),
    });

    const playlistsQuery = useQuery({
        queryKey: ["playlists"],
        queryFn: createQueryFn(apiService.getPlaylists)
    });

    const openDialog = useCallback((modal: DialogType) => {
        setOpenedDialog(modal);
    }, []);

    const closeDialog = useCallback(() => setOpenedDialog(null), []);

    const handleCreateDirectory = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const formJson = Object.fromEntries(formData.entries());
        const name = formJson.name as string;
        createQueryFn(() => apiService.createDirectory(name, currentDirectory))().then(() => {
            directoryContentsQuery.refetch();
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
        closeDialog();
    }, [closeDialog, currentDirectory, directoryContentsQuery]);

    const handleAddTrack = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        const formData = new FormData(e.currentTarget);
        const name = formData.get("name") as string;
        const fileFromForm = formData.get("source") as File;

        const file = fileFromForm ?? fileToUpload;

        if (file == null) {
            OBR.notification.show("No track file specified");
            return;
        }

        closeDialog();

        createQueryFn(() => apiService.addTrack(name, playlistsToAdd, file, currentDirectory))().then(() => {
            playlistsQuery.refetch();
            directoryContentsQuery.refetch();
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
    }, [fileToUpload, playlistsToAdd, closeDialog, playlistsQuery, directoryContentsQuery, currentDirectory]);

    const handleDeleteItems = useCallback((items: SelectedItemType[]) => {
        closeDialog();
        const tracksToDelete = items.filter(item => item.type === "TRACK");
        const directoriesToDelete = items.filter(item => item.type === "DIRECTORY");

        const promises: Promise<never>[] = [];
        if (tracksToDelete.length > 0) {
            promises.push(createQueryFn(() => apiService.deleteTracks(tracksToDelete.map(item => item.id)))());
        }
        if (directoriesToDelete.length > 0) {
            promises.push(createQueryFn(() => apiService.deleteDirectories(directoriesToDelete.map(item => item.id)))());
        }

        Promise.allSettled(promises).then(results => {
            for (const result of results) {
                if (result.status === "rejected") {
                    OBR.notification.show(result.reason.message, "ERROR");
                }
            }
            directoryContentsQuery.refetch();
        });

    }, [directoryContentsQuery, closeDialog]);

    const handleSaveTrack = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (detailedItem == null) {
            OBR.notification.show("No directory speficied", "ERROR");
            return;
        }
        createQueryFn(() => apiService.editTrack(detailedItem.id, detailedItem.name, (detailedItem as Track).playlists ?? []))().then(() => {
            directoryContentsQuery.refetch();
            playlistsQuery.refetch();
            detailedTrack.refetch();
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
        closeDialog();
    }, [closeDialog, detailedItem, directoryContentsQuery, playlistsQuery, detailedTrack]);

    const handleRenameDirectory = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (contextMenuItem == null) {
            OBR.notification.show("No directory speficied", "ERROR");
            return;
        }
        createQueryFn(() => apiService.renameDirectory(contextMenuItem.id, contextMenuItem.name))().then(() => {
            directoryContentsQuery.refetch();
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
        closeDialog();
    }, [closeDialog, contextMenuItem, directoryContentsQuery]);

    const handleEditPlaylists = useCallback((e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const func = editPlaylistsMenuAction === "add" ?
            apiService.addPlaylistsToTracks : (editPlaylistsMenuAction === "remove" ? 
            apiService.removePlaylistsFromTracks : 
            apiService.setPlaylistsForTracks);
        const promise = createQueryFn(() => func(selectedItems.filter(item => item.type == "TRACK").map(item => item.id), playlistsToAdd));
        promise().then(() => {
            playlistsQuery.refetch();
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
        closeDialog();
    }, [closeDialog, editPlaylistsMenuAction, playlistsQuery, playlistsToAdd, selectedItems]);

    const isSelected = useCallback((item: SelectedItemType) => {
        return selectedItems.some(selected => selected.id === item.id && selected.type === item.type);
    }, [selectedItems]);

    const addOrRemoveFromSelection = useCallback((item: SelectedItemType) => {
        if (isSelected(item)) {
            // Already selected, remove from selection
            setSelectedItems(selectedItems.filter(selected => !isSameItem(selected, item)))
        }
        else {
            setSelectedItems([...selectedItems, { id: item.id, type: item.type }]);
        }
    }, [isSelected, selectedItems]);

    const setOrUnsetSelection = useCallback((item: SelectedItemType) => {
        if (isSelected(item)) {
            // Already selected, unset selection
            setSelectedItems([]);
        }
        else {
            setSelectedItems([{ id: item.id, type: item.type }]);
        }
    }, [isSelected]);

    const selectItemRange = useCallback((item: SelectedItemType) => {
        if (selectedItems.length == 0) {
            setSelectedItems([{ id: item.id, type: item.type }]);
        }
        else {
            const availableToSelect = filteredContents ?? [];
            const startIndex = availableToSelect.findIndex(other => isSameItem(other, selectedItems[selectedItems.length - 1]));
            const endIndex = availableToSelect.findIndex(other => isSameItem(other, item));

            if (startIndex == -1 || endIndex == -1) {
                // Should never happen
                setSelectedItems([item]);
                return;
            }

            if (startIndex < endIndex) {
                setSelectedItems(availableToSelect.slice(startIndex, endIndex+1).map(item => ({ id: item.id, type: item.type })));
            }
            else {
                setSelectedItems(availableToSelect.slice(endIndex, startIndex+1).map(item => ({ id: item.id, type: item.type })));
            }
        }
    }, [selectedItems, filteredContents]);

    const handleClickItem = useCallback((e: React.MouseEvent<HTMLDivElement, MouseEvent>, item: SelectedItemType) => {
        if (e.shiftKey) {
            selectItemRange(item);
        }
        else if (e.ctrlKey) {
            addOrRemoveFromSelection(item);
        }
        else {
            setOrUnsetSelection(item);
        }
    }, [addOrRemoveFromSelection, setOrUnsetSelection, selectItemRange]);

    const navigationPush = useCallback((item: DirectoryItem) => {
        setCurrentDirectory(item.id);
        setDirectoryStack(stack => [...stack, item]);
    }, []);

    const navigationPopTo = useCallback((item: DirectoryItem|null) => {
        setDirectoryStack(stack => {
            if (item == null) {
                setCurrentDirectory(null);
                return [];
            }
            const index = stack.findIndex(other => isSameItem(other, item));
            if (index == -1) return stack;
            setCurrentDirectory(stack[index].id);
            return stack.slice(0, index+1);
        });
    }, []);

    const navigationReplace = useCallback((id: number|null) => {
        if (id != null) {
            createQueryFn(() => apiService.getDirectoryInfo(id))().then(item => {
                setCurrentDirectory(item.id);
                setDirectoryStack([item]);
            });
        }
        else {
            setCurrentDirectory(null);
            setDirectoryStack([]);
        }
    }, []);

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        setHoveredDroppable(null);
        setActiveItem(
            (directoryContentsQuery.data ?? []).find(item => item.id == active.id) ?? null
        );
        setDragCount(active.data.current?.itemsToDrag?.length ?? 0);
    }

    const handleDragOver = (event: DragOverEvent) => {
        const { over } = event;
        setHoveredDroppable(over?.id ?? null);
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        
        setHoveredDroppable(null);
        if (!over) return;
        
        const itemsToDrag: SelectedItemType[] = active.data.current?.itemsToDrag || [];

        const overId = typeof over.id === "number" ? over.id : idFromString(over.id);

        if (overId == active.id) {
            // Drag didn't move
            return;
        }
        
        // Client-side check to make sure we're not dragging directories into
        // themselves
        for (const item of itemsToDrag) {
            if (item.id == overId) {
                OBR.notification.show("Can't move directory into itself", "ERROR");
                return;
            }
        }

        createQueryFn(() => apiService.moveItems(itemsToDrag, overId as number))().then(() => {
            directoryContentsQuery.refetch();
        }).catch((error: Error) => {
            OBR.notification.show(error.message, "ERROR");
        });
    };

    const bulkAddTracks = async (files: File[]) => {
        setFileUploadProgress(0);
        let fc = 0;
        for (const file of files) {
            try {
                const name = stripExtension(file.name).slice(0, 63);
                await createQueryFn(() => apiService.addTrack(name, [], file, currentDirectory))();
                setFileUploadProgress(100 * fc++ /  files.length);
            }
            catch (error) {
                OBR.notification.show((error as Error).message, "ERROR");
            }
        }
    };

    const handleDesktopDragDrop = (event: React.DragEvent<HTMLDivElement>) => {
        if (!event.dataTransfer.types.includes("Files")) return;
        event.preventDefault();
        setDraggingFromDesktop(0);

        const files = Array.from(event.dataTransfer.files);
        if (files.length === 0) return;

        const audioFiles = files.filter(file => file.type.startsWith("audio/"));

        if (audioFiles.length == 0) {
            OBR.notification.show("Can only upload audio files", "ERROR");
            return;
        }

        if (audioFiles.length == 1) {
            setPlaylistsToAdd([]);
            setFileToUpload(audioFiles[0]);
            openDialog("add-track-from-drag");
        }
        else {
            openDialog("bulk-add-tracks");
            bulkAddTracks(audioFiles).then(() => {
                directoryContentsQuery.refetch();
                closeDialog();
            });
        }
    };

    useEffect(() => {
        if (detailedTrack.data == undefined) return;
        setDetailedItem({ type: "TRACK", ...detailedTrack.data });
    }, [detailedTrack.data]);

    useEffect(() => {
        if (openedDialog != "track-details") {
            setDetailedItem(null);
        }
    }, [openedDialog]);

    return <Box 
            sx={{ width: "100vw", height: "100vh", overflow: "hidden" }} 
            onDragOver={e => { if (!e.dataTransfer.types.includes("Files")) return; e.preventDefault(); }}
            onDragEnter={e => { if (!e.dataTransfer.types.includes("Files")) return; setDraggingFromDesktop(n => n+1); }}
            onDragLeave={e => { if (!e.dataTransfer.types.includes("Files")) return; setDraggingFromDesktop(n => Math.max(0, n-1)); }}
            onDrop={handleDesktopDragDrop}
        >
        <DndContext
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragAbort={() => setHoveredDroppable(null)}
            onDragCancel={() => setHoveredDroppable(null)}
            collisionDetection={pointerWithin}
        >
            <Box
                sx={{ 
                    backgroundColor: "background.paper", 
                    p: 2, pl: 4, pr: 4, 
                    display: "flex", 
                    flexDirection: "row", 
                    justifyContent: "space-between", 
                    gap: 1, 
                    width: "100%",
                    height: 70,
                    borderBottom: "1px solid gray"
                }}
            >
                <Box sx={{ display: "flex", flexDirection: "row", gap: 5, justifyContent: "space-between", alignItems: "baseline" }}>
                    <Typography variant="h6">
                        <Box component="span" fontWeight="bold">Tracks</Box>
                    </Typography>
                    <Breadcrumbs>
                        <BreadcrumbsItem
                            id="bc-null"
                            text="Home"
                            onClick={() => navigationPopTo(null)}
                            hovered={hoveredDroppable === `bc-null`}
                        />
                        {
                            directoryStack.map((dirItem, i) => (
                                <BreadcrumbsItem
                                    key={i}
                                    id={`bc-${dirItem.id}`}
                                    text={dirItem.name}
                                    onClick={() => navigationPopTo(dirItem)}
                                    hovered={hoveredDroppable === `bc-${dirItem.id}`}
                                />
                            ))
                        }
                    </Breadcrumbs>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-evenly", gap: 1 }}>
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 1,
                            border: "1px solid gray",
                            borderRadius: 4,
                            p: 0.25,
                            pl: 1,
                            pr: 1,
                            transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                            ":focus-within": (theme) => ({
                                borderColor: theme.palette.primary.main,
                                boxShadow: `0 0 0 1.5px ${theme.palette.primary.main}`,
                            }),
                            ":hover":{
                                borderColor: "white",
                            },
                        }}
                    >
                        <IconButton
                            onClick={() => openDialog("search-results")}
                            size="small"
                            title="Advanced search"
                            edge="start"
                        >
                            <Search />
                        </IconButton>
                        <InputBase
                            value={simpleSearchString}
                            onChange={e => setSimpleSearchString(e.target.value)}
                            placeholder="Search..."
                        />
                        <IconButton
                            onClick={() => openDialog("filter")}
                            size="small"
                            title="Advanced search"
                            edge="start"
                        >
                            <FilterAlt />
                        </IconButton>
                    </Box>
                    <IconButton title="Create a new folder" onClick={() => openDialog("add-directory")}>
                        <CreateNewFolder />
                    </IconButton>
                    <Button variant="contained" sx={{ borderRadius: 4 }} title="Upload a new track" onClick={() => openDialog("add-track")}>
                        Track +
                    </Button>
                </Box>
            </Box>
            <Box 
                sx={{ p: 2, pl: 4, pr: 4, height: "calc(100vh - 70px)", overflowY: "auto" }}
            >
                {
                    filteredContents == undefined && directoryContentsQuery.isFetching &&
                    <Box sx={{ display: "flex" }}>
                        <CircularProgress />
                    </Box>
                }
                {   filteredContents != undefined &&
                    <Box
                        sx={{
                            display: "grid",
                            gap: 2,
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                        }}
                    >
                        {filteredContents.filter(item => item.type === "DIRECTORY").map(item => (
                            <DirectoryItemElement
                                key={item.id} 
                                item={item}
                                selected={isSelected(item) || hoveredDroppable === item.id}
                                selectedItems={selectedItems}
                                onContextMenu={event => { setContextMenuItem(item); contextMenuHandler.open(event); }}
                                onClick={e => handleClickItem(e, item)}
                                onDoubleClick={() => navigationPush(item)}
                            />
                        ))}
                        {filteredContents.filter(item => item.type === "TRACK").map(item => (
                            <TrackItemElement
                                key={item.id}
                                item={item}
                                selected={isSelected(item)}
                                selectedItems={selectedItems}
                                onContextMenu={event => { setContextMenuItem(item); contextMenuHandler.open(event); }}
                                onClick={e => handleClickItem(e, item)}
                                onDoubleClick={() => { setDetailedItem(item); openDialog("track-details"); }} 
                            />
                        ))}
                    </Box>
                }
            </Box>
            <Box 
                sx={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0, 0, 0, 0.5)",
                    opacity: draggingFromDesktop > 0 && openedDialog == null ? 1 : 0,
                    transition: "opacity 0.2s ease",
                    pointerEvents: "none",
                }}
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                    }}
                >
                    <UploadFile sx={{ width: 150, height: 150 }} />
                    <Box sx={{ p: 1 }} />
                    <Typography variant="h4">Drag files to upload them</Typography>
                </Box>
            </Box>
            <DragOverlay>
                {
                    activeItem &&
                    <DragOverlayItem item={activeItem} dragCount={dragCount} />
                }
            </DragOverlay>
        </DndContext>
        {
            selectedItems.length > 0 &&
            <IconButton
                ref={menuOptionsButtonRef}
                onClick={() => globalContextMenuHandler.open()}
                sx={{
                    position: "absolute",
                    bottom: 15,
                    right: 25,
                    backgroundColor: "background.paper",
                    boxShadow: "2px 2px 1px 0px rgba(0,0,0,0.5)"
                }}
            >
                <MoreVert />
            </IconButton>
        }

        {/* Context Menus */}
        <ItemContextMenu 
            openDialog={openDialog}
            menuOptionsButtonRef={menuOptionsButtonRef}
            setDetailedItem={setDetailedItem}
            setItemsToDelete={setItemsToDelete}
            contextMenuHandler={contextMenuHandler}
            contextMenuItem={contextMenuItem}
        />
        <GlobalSelectionContextMenu 
            openDialog={openDialog}
            menuOptionsButtonRef={menuOptionsButtonRef}
            setItemsToDelete={setItemsToDelete}
            contextMenuHandler={globalContextMenuHandler}
            setEditPlaylistsMenuAction={setEditPlaylistsMenuAction}
            selectedItems={selectedItems}
        />

        {/* Dialogs */}
        <FilterDialog 
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            handleAddTrack={handleAddTrack}
            playlistsQueryData={playlistsQuery.data}
            setFilterPlaylists={setFilterPlaylists}
            filterPlaylists={filterPlaylists}
            playlistsToFilter={playlistsToFilter}
            setPlaylistsToFilter={setPlaylistsToFilter}
        />
        <EditPlaylistsDialog
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            handleAddTrack={handleAddTrack}
            playlistsQueryData={playlistsQuery.data}
            editPlaylistsMenuAction={editPlaylistsMenuAction}
            setEditPlaylistsMenuAction={setEditPlaylistsMenuAction}
            handleEditPlaylists={handleEditPlaylists}
        />
        <BulkAddTracksDialog 
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            fileUploadProgress={fileUploadProgress}
            handleAddTrack={handleAddTrack}
        />
        <AddDirectory 
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            handleCreateDirectory={handleCreateDirectory}
        />
        <AddTrackFromDragDialog
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            filename={fileToUpload?.name}
            handleAddTrack={handleAddTrack}
            playlistsQueryData={playlistsQuery.data}
        />
        <AddTrackDialog
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            filename={fileToUpload?.name}
            handleAddTrack={handleAddTrack}
            playlistsQueryData={playlistsQuery.data}
        />
        <DeleteItemsDialog 
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            handleDeleteItems={handleDeleteItems}
            itemsToDelete={itemsToDelete}
        />
        <RenameDirectoryDialog 
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            contextMenuItem={contextMenuItem}
            setContextMenuItem={setContextMenuItem}
            handleRenameDirectory={handleRenameDirectory}
        />
        <TrackDetailsDialog 
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            setDetailedItem={setDetailedItem}
            detailedItem={detailedItem}
            handleSaveTrack={handleSaveTrack}
            playlistsQueryData={playlistsQuery.data}
        />
        <SearchResultsDialog
            openedDialog={openedDialog}
            closeDialog={closeDialog}
            filterPlaylists={filterPlaylists}
            playlists={playlistsToFilter}
            searchString={simpleSearchString}
            navigationReplace={navigationReplace}
        />
    </Box>;
}
