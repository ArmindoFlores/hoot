import { DirectoryContents, DirectoryItem, DirectoryType, InfiniteQuery, SearchedItem } from "../types/storage";

import { ENDPOINT } from "../config";
import { Track } from "../types/tracks";
import { User } from "../types/user";

export type BackendAPIError = {
    error: string;
};

export type BackendAPIResponse<T> = Promise<T|BackendAPIError>;

export function isBackendAPIError<T>(response: T|BackendAPIError): response is BackendAPIError {
    return (response as BackendAPIError).error != undefined;
}

export function createQueryFn<T>(fn: () => BackendAPIResponse<T>) {
    return async () => {
        const result = await fn();
        if (isBackendAPIError(result)) {
            throw new Error(result.error);
        }
        return result;
    };
}

async function request(endpoint: string, method: string, body?: BodyInit, json = true) {
    const headers = new Headers();
    if (json) headers.append("Content-Type", "application/json");

    const req = await fetch(`${ENDPOINT}${endpoint}`, {
        method: method,
        credentials: "include",
        headers: headers,
        body: body
    });
    if (!req.ok && req.headers.get("Content-Type") != "application/json") {
        throw new Error(`Request failed: ${req.status} ${req.statusText}`);
    }
    return req.json();
}

function addTrack(name: string, playlists: string[], file: File, parent: number|null): BackendAPIResponse<Track> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("metadata", JSON.stringify({
        track_name: name,
        playlists,
        parent
    }));

    return request(
        "/tracks/new",
        "POST",
        formData,
        false
    );
}

function editTrack(id: number, name: string, playlists: string[]): BackendAPIResponse<never> {
    return request(
        `/tracks/${id}`,
        "PATCH",
        JSON.stringify({
            name,
            playlists
        })
    )
}

function addTrackFromURL(name: string, playlists: string[], source: string): BackendAPIResponse<Track> {
    const formData = new FormData();
    formData.append("metadata", JSON.stringify({
        track_name: name,
        playlists,
        source
    }));

    return request(
        "/tracks/new",
        "POST",
        formData,
        false
    );
}

function deleteTracks(ids: number[]): BackendAPIResponse<never> {
    return request(
        `/tracks`,
        "DELETE",
        JSON.stringify({
            ids
        })
    );
}

function addPlaylistsToTracks(trackIds: number[], playlists: string[]): BackendAPIResponse<never> {
    return request(
        "/playlists/add_tracks",
        "POST",
        JSON.stringify({
            names: playlists,
            tracks: trackIds
        })
    );
}

function removePlaylistsFromTracks(trackIds: number[], playlists: string[]): BackendAPIResponse<never> {
    return request(
        "/playlists/remove_tracks",
        "POST",
        JSON.stringify({
            names: playlists,
            tracks: trackIds
        })
    );
}

function setPlaylistsForTracks(trackIds: number[], playlists: string[]): BackendAPIResponse<never> {
    return request(
        "/playlists/edit_tracks",
        "POST",
        JSON.stringify({
            names: playlists,
            tracks: trackIds
        })
    );
}

function getProfile(): BackendAPIResponse<User> {
    return request("/user", "GET");
}

function getPlaylists(): BackendAPIResponse<string[]> {
    return request("/playlists", "GET");
}

function getPlaylistsWithIDs(): BackendAPIResponse<{id: number, name: string}[]> {
    return request("/playlists?include_ids=true", "GET");
}

function getPlaylistTracks(playlist?: number): BackendAPIResponse<Track[]> {
    return request(`/playlists/${playlist ?? "all"}/tracks`, "GET");
}

function getTrack(trackId: number): BackendAPIResponse<Track> {
    return request(`/tracks/${trackId}`, "GET");
}

function getTracks(): BackendAPIResponse<Record<string, Track[]>> {
    return request("/tracks", "GET");
}

function searchForTracks(searchString: string|null, playlists: string[]|null, offset: number = 0, limit: number = 20): BackendAPIResponse<InfiniteQuery<SearchedItem>> {
    return request(
        "/tracks/search",
        "POST",
        JSON.stringify({
            search_string: searchString,
            playlists,
            offset,
            limit
        })
    );
}

function getDirectoryContents(id: number|null): BackendAPIResponse<DirectoryContents> {
    return request(
        `/storage/${id}/contents`,
        "GET",
    );
}

function createDirectory(name: string, parent: number|null): BackendAPIResponse<never> {
    return request(
        `/storage/${parent}`,
        "POST",
        JSON.stringify({
            name
        })
    );
}

function createPlaylist(name: string): BackendAPIResponse<never> {
    return request(
        `/playlists`,
        "POST",
        JSON.stringify({name})
    );
}

function moveItems(items: { id: number, type: DirectoryItem["type"] }[], parent: number|null): BackendAPIResponse<never> {
    return request(
        `/storage/move`,
        "POST",
        JSON.stringify({
            items,
            parent
        })
    );
}

function renameDirectory(id: number, name: string): BackendAPIResponse<never> {
    return request(
        `/storage/${id}/rename`,
        "PATCH",
        JSON.stringify({
            name
        })
    );
}

function deleteDirectories(ids: number[]): BackendAPIResponse<never> {
    return request(
        `/storage`,
        "DELETE",
        JSON.stringify({
            ids
        })
    );
}

function deletePlaylists(ids: number[]): BackendAPIResponse<never> {
    return request(
        `/playlists`,
        "DELETE",
        JSON.stringify({
            ids
        })
    );
}

function getDirectoryInfo(id: number): BackendAPIResponse<DirectoryType> {
    return request(
        `/storage/${id}`,
        "GET",
    );
}

function login(email: string, password: string): BackendAPIResponse<User> {
    return request(
        "/auth/login",
        "POST",
        JSON.stringify({
            email,
            password
        })
    );
}

function logout(): BackendAPIResponse<never> {
    return request(
        "/auth/logout",
        "POST",
    );
}

function signup(email: string, username: string, password: string, confirmPassword: string): BackendAPIResponse<never> {
    return request(
        "/user",
        "PUT",
        JSON.stringify({
            email,
            username,
            password,
            confirm_password: confirmPassword
        })
    );
}

function unlinkPatreon(): BackendAPIResponse<never> {
    return request(
        "/user/unlink_patreon",
        "POST",
    );
}

function verifyEmail(verificationCode: string) {
    return request(
        `/auth/verify/${verificationCode}`,
        "POST"
    );
}

export const backendAPIService = {
    addTrack,
    addTrackFromURL,
    editTrack,
    deleteTracks,
    getProfile,
    getTrack,
    getTracks,
    searchForTracks,
    addPlaylistsToTracks,
    removePlaylistsFromTracks,
    setPlaylistsForTracks,
    getDirectoryContents,
    createDirectory,
    createPlaylist,
    moveItems,
    renameDirectory,
    deleteDirectories,
    deletePlaylists,
    getDirectoryInfo,
    getPlaylists,
    getPlaylistsWithIDs,
    getPlaylistTracks,
    login,
    logout,
    signup,
    unlinkPatreon,
    verifyEmail,
};
