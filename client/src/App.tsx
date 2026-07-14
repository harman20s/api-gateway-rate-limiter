import { useGatewayEvents } from "./hooks/useGatewayEvents";
import { TrafficChart } from "./components/TrafficChart";
import { BreakerStatus } from "./components/BreakerStatus";
import { LiveFeed } from "./components/LiveFeed";
import { FloodButton } from "./components/FloodButton";
import "./App.css";

function App() {
  const { connected, feed, breakerStates } = useGatewayEvents();

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>API Gateway Dashboard</h1>
        <span className={`status-pill ${connected ? "live" : "offline"}`}>
          {connected ? "● live" : "○ disconnected"}
        </span>
      </header>

      <div className="dashboard-grid">
        <TrafficChart feed={feed} />
        <BreakerStatus liveStates={breakerStates} />
        <FloodButton />
        <LiveFeed feed={feed} />
      </div>
    </div>
  );
}

export default App;
