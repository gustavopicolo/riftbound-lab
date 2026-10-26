import tournaments from "@/data/tournaments.json";
import App from "./App";

export default function Page() {
  return <App events={tournaments} />;
}
