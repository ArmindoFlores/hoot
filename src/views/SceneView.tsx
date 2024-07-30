import "react-toggle/style.css";

import { RepeatMode, useAudioPlayer } from "../components/AudioPlayerProvider";
import { faAdd, faClose, faRepeat, faSave } from "@fortawesome/free-solid-svg-icons";
import { useCallback, useEffect, useState } from "react";
import { useOBR, useOBRMessaging } from "../react-obr/providers";

import { APP_KEY } from "../config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import OBR from "@owlbear-rodeo/sdk";
import ReactSlider from "react-slider";
import RepeatSelf from "../assets/repeat-self.svg";
import Toggle from "react-toggle";
import { useSettings } from "../components/SettingsProvider";
import { useTracks } from "../components/TrackProvider";

type AutoplayList = {
    playlist: string;
    track: string;
    volume: number;
    shuffle: boolean;
    fadeIn: boolean;
    repeatMode: RepeatMode;
}[];

interface AutoplayPlaylistItemProps {
    autoplayEntry: AutoplayList[number];
    setAutoplayEntry: (entry: AutoplayList[number]) => void;
}

export function SceneView() {
    const { tracks, playlists } = useTracks();
    const { setPlaylist, playing } = useAudioPlayer();
    const { stopOtherTracks } = useSettings();
    const { sceneMetadata, setSceneMetadata, sceneReady } = useOBR();
    const { sendMessage } = useOBRMessaging();

    const [ autoplay, setAutoplay ] = useState<AutoplayList>([]);
    const [ playlistsToFadeIn, setPlaylistsToFadeIn ] = useState<{ playlist: string, track: string }[]>([]);

    const AutoplayPlaylistItem = useCallback(({ autoplayEntry, setAutoplayEntry }: AutoplayPlaylistItemProps) => {
        const [ playlist, setPlaylist ] = useState(autoplayEntry.playlist);
        const [ track, setTrack ] = useState(autoplayEntry.track);
        const [ shuffle, setShuffle ] = useState(autoplayEntry.shuffle);
        const [ fadeIn, setFadeIn ] = useState(autoplayEntry.fadeIn);
        const [ repeatMode, setRepeatMode ] = useState(autoplayEntry.repeatMode);
        const [ volume, setVolume ] = useState(autoplayEntry.volume);
    
        const nextRepeatMode = () => {
            if (repeatMode === "no-repeat") {
                setRepeatMode("repeat-all");
            }
            else if (repeatMode === "repeat-all") {
                setRepeatMode("repeat-self");
            }
            else {
                setRepeatMode("no-repeat");
            }
        }

        const handleClose = () => {
            setAutoplay(old => {
                const arr = old.filter(item => item != autoplayEntry)
                setSceneMetadata({
                    [`${APP_KEY}/autoplay`]: arr.length > 0 ? arr : undefined
                });
                return arr;
            });
        }

        const handleSave = () => {
            setAutoplayEntry({ playlist, track, shuffle, fadeIn, repeatMode, volume });
        }
    
        return <div className="autoplay-container">
            <div className="autoplay-row">
                <label>Playlist name</label>
                <input
                    className={`small-input ${playlists.includes(playlist) ? "" : "invalid-value"}`}
                    value={playlist}
                    placeholder="playlist name"
                    onChange={(event) => setPlaylist(event.target.value)}
                />
            </div>
            <div className="autoplay-row">
                <label>Track name</label>
                <input
                    className={`small-input ${
                        (track == "" || tracks.get(playlist)?.map?.(track => track.name)?.includes?.(track))
                        ? "" : "invalid-value"
                    }`}
                    value={track}
                    placeholder="track name"
                    onChange={(event) => setTrack(event.target.value)}
                />
            </div>
            <div className="autoplay-row">
                <div className="autoplay-subrow">
                    <label>Shuffle</label>
                    <div style={{paddingLeft: "0.25rem", display: "flex"}}>
                        <Toggle checked={shuffle} onChange={(value) => setShuffle(value.target.checked)} type="checkbox" />
                    </div>
                </div>
                <div className="autoplay-subrow">
                    <label>Fade in</label>
                    <div style={{paddingLeft: "0.25rem", display: "flex"}}>
                        <Toggle checked={fadeIn} onChange={(value) => setFadeIn(value.target.checked)} type="checkbox" />
                    </div>
                </div>
            </div>
            <div className="autoplay-row">
                <div className="autoplay-subrow">
                    <label style={{paddingRight: "0.5rem"}}>Repeat mode</label>
                    <div 
                        className={`repeat-button clickable ${repeatMode !== "no-repeat" ? "highlighted" : ""}`}
                        onClick={nextRepeatMode}
                    >
                        {
                            repeatMode === "repeat-self" ? 
                            <img src={RepeatSelf} style={{width: "1rem"}} className="unselectable" />
                            : <FontAwesomeIcon icon={faRepeat} />
                        }
                    </div>
                </div>
                <div className="autoplay-subrow">
                    <label style={{paddingRight: "0.5rem"}}>Volume</label>
                    <div className="horizontal-volume-slider-container">
                        <ReactSlider
                            className="horizontal-volume-slider"
                            thumbClassName={`volume-slider-thumb`}
                            trackClassName={`horizontal-volume-slider-track`}
                            min={0}
                            max={100}
                            value={volume * 100}
                            onChange={value => setVolume(value / 100)}
                            orientation="horizontal"
                        />
                    </div>
                </div>
            </div>
            <div 
                className="remove-button-container clickable"
                onClick={handleClose}
            >
                <FontAwesomeIcon icon={faClose} />
            </div>
            <div 
                className="save-button-container clickable"
                onClick={handleSave}
            >
                <FontAwesomeIcon icon={faSave} />
            </div>
        </div>;
    }, [setAutoplay, playlists, setSceneMetadata]);

    const addNewPlaylist = () => {
        setAutoplay([
            ...autoplay, 
            { 
                playlist: "", 
                track: "", 
                volume: 0.75, 
                shuffle: true, 
                fadeIn: true, 
                repeatMode: "repeat-all" 
            }
        ]);
    }

    const setAutoplayEntry = (entry: AutoplayList[number], index: number) => {
        setAutoplay(old => {
            old.splice(index, 1, entry);
            setSceneMetadata({
                [`${APP_KEY}/autoplay`]: old
            });
            return old;
        });
    }

    useEffect(() => {
        const autoplay = sceneMetadata[`${APP_KEY}/autoplay`] as (AutoplayList|undefined);
        setAutoplay(autoplay ?? []);
        setPlaylistsToFadeIn([]);
    }, [sceneMetadata]);

    useEffect(() => {
        const autoplay = sceneMetadata[`${APP_KEY}/autoplay`] as (AutoplayList|undefined);
        setAutoplay(autoplay ?? []);

        // Start autoplay if it is setup
        if (sceneReady && autoplay != undefined) {
            const playlistsToFadeIn: { playlist: string, track: string }[] = [];

            for (const autoplayPlaylist of autoplay) {
                const trackList = tracks.get(autoplayPlaylist.playlist);
                if (trackList === undefined) {
                    OBR.notification.show(`Could not find playlist "${autoplayPlaylist.playlist}" to autoplay`, "ERROR");
                    continue;
                }
                // If a track was chosen, play that track. Else, if shuffling, play a random track.
                // Otherwise, play the first track of the track list.
                const index = autoplayPlaylist.shuffle ? Math.floor(Math.random() * trackList.length) : 0;
                const currentlyPlaying = playing[autoplayPlaylist.playlist];
                const track = autoplayPlaylist.track !== "" ? trackList.find(option => option.name === autoplayPlaylist.track) : (currentlyPlaying ? currentlyPlaying.track : trackList[index]);
                if (track === undefined) {
                    OBR.notification.show(`Could not find track "${autoplayPlaylist.track}" to autoplay`, "ERROR");
                    continue;
                }
                const isSameTrack = currentlyPlaying && (currentlyPlaying.track.name === autoplayPlaylist.track || autoplayPlaylist.track === "");
                const canFadeIn = (!isSameTrack || currentlyPlaying.playing === false) && autoplayPlaylist.fadeIn;
                setPlaylist(
                    autoplayPlaylist.playlist,
                    {
                        track,
                        playing: !canFadeIn,  // For fade-in, we send a message later
                        time: (isSameTrack ? currentlyPlaying?.time : 0) ?? 0,
                        shuffle: autoplayPlaylist.shuffle,
                        loaded: (isSameTrack ? currentlyPlaying?.loaded : false) ?? false,
                        repeatMode: autoplayPlaylist.repeatMode,
                        volume: autoplayPlaylist.volume,
                        duration: isSameTrack ? currentlyPlaying?.duration : undefined
                    }
                );
                if (canFadeIn) {
                    playlistsToFadeIn.push({
                        track: autoplayPlaylist.track,
                        playlist: autoplayPlaylist.playlist
                    });
                }
            }

            //  After this render, fade in the missing playlists 
            setPlaylistsToFadeIn(playlistsToFadeIn);

            if (stopOtherTracks) {
                for (const playlist of playlists) {
                    // If it this playlist will be set by us, do nothing here
                    if (autoplay.map(ap => ap.playlist).includes(playlist)) continue;

                    // Else, fade it out
                    const currentlyPlaying = playing[playlist];
                    if (currentlyPlaying == undefined) continue;
                    sendMessage(
                        { 
                            type: "fade",
                            payload: {
                                fade: "out",
                                playlist
                            }
                        }, 
                        undefined,
                        "LOCAL"
                    );
                }
            }
        }
    }, [sceneReady]);

    useEffect(() => {
        // This will run after entering a new scene, and after the initial track
        // setup is performed, so that all playlists are ready to fade in.
        if (playlistsToFadeIn.length) {
            console.log("Checking readiness...");
            const startedPlaylists: string[] = [];
            for (const { playlist, track } of playlistsToFadeIn) {
                const playingPlaylist = playing[playlist];
                if (playingPlaylist?.playing === undefined || playingPlaylist.playing) return;
                if (track != "" && playingPlaylist.track.name !== track) return;
                if (!playingPlaylist.loaded) return;
                sendMessage(
                    {
                        type: "fade",
                        payload: {
                            fade: "in",
                            playlist
                        }
                    }, 
                    undefined,
                    "LOCAL"
                );
                startedPlaylists.push(playlist);
            }
            console.log("Started", startedPlaylists);
            const newPlaylists = playlistsToFadeIn.filter(({ playlist }) => !startedPlaylists.includes(playlist))
            setPlaylistsToFadeIn(newPlaylists);
            console.log("New:", newPlaylists);
        }
    }, [playlistsToFadeIn, playing]);

    return <div className="generic-view">
        <div className="generic-view-inner">
            <h2>Autoplay</h2>
            {
                sceneReady ? (<>
                {
                    autoplay.length == 0 && 
                    <p>
                        Currently, this scene has no defined playlist(s) to autoplay.
                        Use the "Add Playlist" button to add one.
                    </p>
                }
                {
                    autoplay.map((autoplayEntry, index) => (
                        <AutoplayPlaylistItem 
                            key={index}
                            autoplayEntry={autoplayEntry}
                            setAutoplayEntry={(entry: AutoplayList[number]) => setAutoplayEntry(entry, index)}
                        />
                    ))
                }
                <br></br>
                <div className="scene-button-container">
                    <div className="button clickable unselectable" onClick={addNewPlaylist}>
                        <p className="bold text-medium"><FontAwesomeIcon icon={faAdd} /> Add Playlist</p>
                    </div>
                </div>
                </>) :
                <p>
                    No scene loaded.
                </p>
            }
        </div>
    </div>;
}
