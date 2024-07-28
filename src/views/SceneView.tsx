import { faAdd, faClose, faRepeat } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useState } from "react";

import { APP_KEY } from "../config";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ReactSlider from "react-slider";
import { RepeatMode } from "../components/AudioPlayerProvider";
import RepeatSelf from "../assets/repeat-self.svg";
import localforage from "localforage";
import { useOBR } from "../react-obr/providers";
import { useTracks } from "../components/TrackProvider";

type AutoplayList = {
    playlist: string;
    track: string;
    volume: number;
    shuffle: boolean;
    fadeIn: boolean;
    repeatMode: RepeatMode;
}[];

export function SceneView() {
    const { tracks, playlists } = useTracks();
    const { sceneMetadata } = useOBR();

    const [ autoplay, setAutoplay ] = useState<AutoplayList>([]);

    function AutoplayPlaylistItem({ autoplayEntry }: { autoplayEntry: AutoplayList[number] }) {
    
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
    
        return <div className="autoplay-container">
            <div className="autoplay-row">
                <label>Playlist name</label>
                <input
                    className={playlists.includes(playlist) ? undefined : "invalid-value"}
                    value={playlist}
                    onChange={(event) => setPlaylist(event.target.value)}
                />
            </div>
            <div className="autoplay-row">
                <label>Track name</label>
                <input
                    className={
                        (track =="" || tracks.get(playlist)?.map?.(track => track.name)?.includes?.(track))
                        ? undefined : "invalid-value"
                    }
                    value={track}
                    onChange={(event) => setTrack(event.target.value)}
                />
            </div>
            <div className="autoplay-row">
                <div className="autoplay-subrow">
                    <label>Shuffle</label>
                    <input checked={shuffle} onChange={(value) => setShuffle(value.target.checked)} type="checkbox" />
                </div>
                <div className="autoplay-subrow">
                    <label>Fade in</label>
                    <input checked={fadeIn} onChange={(value) => setFadeIn(value.target.checked)} type="checkbox" />
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
                className="close-button-container clickable"
                onClick={() => setAutoplay(old => old.filter(item => item != autoplayEntry))}
            >
                <FontAwesomeIcon icon={faClose} />
            </div>
        </div>;
    }

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

    useEffect(() => {
        const localForageKeySuffix = sceneMetadata[`${APP_KEY}/autoplay`];
        if (typeof localForageKeySuffix === "string") {
            localforage.getItem(`autoplay-scene-${localForageKeySuffix}`).then(autoplay => {
                const autoplayList = autoplay as (AutoplayList|null);
                if (autoplayList == null) return;
                setAutoplay(autoplayList);
            });
        }
    }, [sceneMetadata]);

    return <div className="generic-view">
        <div className="generic-view-inner">
            <h2>Autoplay</h2>
            {
                autoplay.length == 0 && 
                <p>
                    Currently, this scene has no defined playlist(s) to autoplay.
                    Use the "Add Playlist" button to add one.
                </p>
            }
            {
                autoplay.map((autoplayEntry, index) => (
                    <AutoplayPlaylistItem key={index} autoplayEntry={autoplayEntry} />
                ))
            }
            <br></br>
            <div className="scene-button-container">
                <div className="button clickable unselectable" onClick={addNewPlaylist}>
                    <p className="bold text-medium"><FontAwesomeIcon icon={faAdd} /> Add Playlist</p>
                </div>
            </div>
        </div>
    </div>;
}
