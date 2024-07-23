import "./App.css";

import { BaseOBRProvider } from "./react-obr/providers";
import { Hoot } from "./views/Hoot";

function App() {
    return (
        <BaseOBRProvider>
            <Hoot />
        </BaseOBRProvider>
    );
}

export default App;
