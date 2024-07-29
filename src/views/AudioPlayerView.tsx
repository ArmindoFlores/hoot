import { faVolumeHigh, faVolumeLow, faVolumeMute, faVolumeOff } from "@fortawesome/free-solid-svg-icons";
import { useEffect, useMemo, useState } from "react";

import { AudioControls } from "../components/AudioControls";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import ReactSlider from "react-slider";
import { useAudioPlayer } from "../components/AudioPlayerProvider";

export function AudioPlayerView() {
    const { playing, volume, setVolume } = useAudioPlayer();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);

    const [ previousVolume, setPreviousVolume ] = useState(volume); 
    const [ mute, setMute ] = useState(false);
    const [ volumeHovered, setVolumeHovered ] = useState(false);

    const toggleMute = () => {
        if (volume === 0) {
            setVolume(previousVolume);
        }
        else {
            setPreviousVolume(volume);
            setMute(true);
            setVolume(0);
        }
    }

    useEffect(() => {
        if (volume !== 0) {
            setMute(false);
        }
    }, [volume]);

    return <div className="audio-player-container">
        <div className="audio-player-container-inner">
            <h2>Currently Playing</h2>
            {
                playingPlaylists.length === 0 &&
                <p>
                    No tracks are playing. 
                    Go to the <u><span className="clickable" onClick={() => {}}>track list</span></u> tab
                    to queue up.
                </p>
            }
            {
                playingPlaylists.map(playlist => (
                    <div key={playlist} className="audio-control-holder">
                        <AudioControls playlist={playlist} />
                    </div>
                ))
            }
        </div>
        <div className="global-volume" onMouseEnter={() => setVolumeHovered(true)}onMouseLeave={() => setVolumeHovered(false)}>
            <div className={`global-volume-slider-container ${volumeHovered ? "global-volume-shown" : ""}`}>
                <ReactSlider
                    className="volume-slider"
                    thumbClassName={`volume-slider-thumb`}
                    trackClassName={`volume-slider-track`}
                    min={0}
                    max={100}
                    value={(volume ?? 0) * 100}
                    onChange={value => setVolume(value / 100)}
                    orientation="vertical"
                    invert
                />
            </div>
            <div 
                className="global-volume-icon-container clickable"
                onClick={toggleMute}
            >
                <FontAwesomeIcon 
                    icon={
                        mute
                        ? faVolumeMute
                        : volume == 0 
                        ? faVolumeOff 
                        : (volume < 0.5)
                        ? faVolumeLow
                        : faVolumeHigh
                    } 
                    style={{width: "1rem"}}
                />
            </div>
        </div>
    </div>;
}
