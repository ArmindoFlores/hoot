import { AudioControls } from "../components/AudioControls";
import { useAudioPlayer } from "../components/AudioPlayerProvider";
import { useMemo } from "react";

export function AudioPlayerView() {
    const { playing } = useAudioPlayer();
    const playingPlaylists = useMemo(() => Object.keys(playing), [playing]);

    return <div className="audio-player-container">
        <div className="audio-player-container-inner">
            {
                playingPlaylists.map(playlist => (
                    <div key={playlist} className="audio-control-holder">
                        <AudioControls playlist={playlist} />
                    </div>
                ))
            }
            {
                playingPlaylists.length === 0 &&
                <p>
                    No tracks are playing. 
                    Go to the <u><span className="clickable" onClick={() => {}}>track list</span></u> tab
                    to queue up.
                </p>
            }
        </div>
    </div>;
}
