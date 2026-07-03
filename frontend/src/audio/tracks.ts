import { backendAPIService, createQueryFn } from "../services/backendAPIService";

import { Track } from "../types/tracks";
import { expired } from "../utils";

export class TrackLibrary {
    protected $tracks = new Map<number, Track>();
    protected $tracksByPlaylist = new Map<string, number[]>();
    
    constructor() {

    }

    getPlaylistTrackIDs(playlist: string) {
        return this.$tracksByPlaylist.get(playlist);
    }

    getPlaylistTracks(playlist: string) {
        return this.getPlaylistTrackIDs(playlist)?.map?.(id => this.$tracks.get(id)!);
    }

    async fetch() {
        const newTracksByPlaylist = await createQueryFn(backendAPIService.getTracks)();
        const newTracks = Object.values(newTracksByPlaylist).flat();
        const newTrackIds = new Set(newTracks.map(track => track.id));
        const trackIdsToDelete = Object.values(this.$tracks.keys()).filter(oldTrackId => !newTrackIds.has(oldTrackId));
        
        for (const trackIdToDelete of trackIdsToDelete) {
            this.$tracks.delete(trackIdToDelete);
        }

        for (const track of newTracks) {
            if (!this.$tracks.has(track.id) || track.source !== null) {
                this.$tracks.set(track.id, track);
                continue;
            }
            const oldTrack = this.$tracks.get(track.id)!;
            if (oldTrack.source_expiration !== track.source_expiration) {
                this.$tracks.set(track.id, track);
            }
        }

        this.$tracksByPlaylist = new Map(Object.entries(newTracksByPlaylist).map(([key, value]) => [
            key,
            value.map(track => track.id)
        ]));
    }

    async getLoadedTrack(id: number) {
        const track = this.$tracks.get(id);
        if (track === undefined) {
            throw new Error(`tried to load a non-existing track with ID ${id}`);
        }
        if (track.source && !expired(track.source_expiration)) {
            return track as Omit<Track, "source"> & { source: string };
        }
        const loadedTrack = await createQueryFn(() => backendAPIService.getTrack(track.id))();
        this.$tracks.set(id, loadedTrack);
        return loadedTrack as Omit<Track, "source"> & { source: string };
    }

    getTrack(id: number) {
        return this.$tracks.get(id);
    }
}
