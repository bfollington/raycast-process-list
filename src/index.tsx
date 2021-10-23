import { ActionPanel, List, Toast, ToastStyle } from "@raycast/api";
import { exec } from "child_process";
import { useEffect, useState } from "react";
import util from "util";

const execP = util.promisify(exec);

export default function ArticleList() {
  const [output, setOutput] = useState<SystemStats | null>(null);
  const [search, setSearch] = useState<string>("");

  useEffect(() => {
    const cpuToast = new Toast({ style: ToastStyle.Animated, message: "Sampling...", title: "CPU / Memory" });

    async function list() {
      cpuToast.hide();
      cpuToast.style = ToastStyle.Animated;
      await cpuToast.show();

      const out = await listProcesses();
      setOutput(out);

      // cpuToast.style = ToastStyle.Success;
      cpuToast.message = `CPU user: ${out.cpu.userPercentage}% sys: ${out.cpu.systemPercentage}%\nMemory ${out.memory.unusedMemory} free`;
    }

    list();

    () => {
      cpuToast.hide();
    };
  }, []);

  const processes =
    search.length > 0
      ? output?.processes.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : output?.processes;

  return (
    <List isLoading={output === null} searchBarPlaceholder="Filter processes by name" onSearchTextChange={setSearch}>
      {processes && processes.map((p) => <ProcessListItem key={p.pid} process={p} />)}
    </List>
  );
}

function ProcessListItem(props: { process: Process }) {
  const p = props.process;
  // const [path, setPath] = useState("");

  // useEffect(() => {
  // const fetchIcon = async () => {
  //   try {
  //     const guessPath = await execP(`ps -o comm= -p ${p.pid}`);
  //     if (guessPath.stdout.includes(".app")) {
  //       const cutPoint = guessPath.stdout.indexOf(".app");
  //       setPath(guessPath.stdout.substr(0, cutPoint + 4));
  //     }
  //   } catch (e) {
  //     setPath("");
  //   }
  // };
  // Urgh, lots of work to get the application path but the FileIcon handling doesn't render it
  // Unsure how it's accomplished in the built-in application search?
  // fetchIcon();
  // }, []);

  return (
    <List.Item
      id={p.pid}
      key={p.pid}
      title={`${p.name}`}
      accessoryTitle={`CPU ${p.cpuPercentage}%, memory: ${p.memoryUsage}`}
      icon={"memorychip-16"}
      actions={
        <ActionPanel>
          <ActionPanel.Item title="Quit Process" onAction={() => exec(`kill ${p.pid}`)} />
          <ActionPanel.Item title="Force Kill Process" onAction={() => exec(`kill -9 ${p.pid}`)} />
        </ActionPanel>
      }
    />
  );
}

const MAX_LIST_SIZE = 50;
const cpuRe = /CPU usage: ([0-9.]+)% user, ([0-9.]+)% sys, ([0-9.]+)% idle/gm;
const memRe = /PhysMem: ([0-9GMK]+) used \(([0-9GMK]+) wired\), ([0-9GMK]+) unused./gm;
const processRe =
  /^([0-9]+)\s+([a-zA-Z0-9\s_.\-()]+)\s+([0-9.]+)\s+[0-9:.]+\s+[0-9/]+\s+[0-9]+\s+[0-9]+\s+([0-9GMK]+).+$/gm;

type Process = {
  pid: string;
  name: string;
  cpuPercentage: string;
  memoryUsage: string;
};

type CpuUsage = {
  userPercentage: string;
  systemPercentage: string;
  idlePercentage: string;
};

type MemoryUsage = {
  usedMemory: string;
  wiredMemory: string;
  unusedMemory: string;
};

type SystemStats = {
  cpu: CpuUsage;
  memory: MemoryUsage;
  processes: Process[];
};

async function listProcesses(): Promise<SystemStats> {
  // We have to run top with -l 2 to get real CPU usage (to compare samples)
  const result = await execP("top -l 2 ");
  // We throw away the first set of data with incorrect CPU usage
  const usefulDataIndex = result.stdout.lastIndexOf("Processes:");
  const out = result.stdout.substr(usefulDataIndex);

  const cpu = cpuRe.exec(out);
  const mem = memRe.exec(out);
  const processes = out.matchAll(processRe);

  const processList: Process[] = [];

  // TODO: re-write this map-reduce style
  let count = 0;
  for (const p of processes) {
    if (count > MAX_LIST_SIZE) break;
    const entry: Process = {
      pid: p[1],
      name: p[2],
      cpuPercentage: p[3],
      memoryUsage: p[4],
    };
    processList.push(entry);
    count++;
  }

  // Probably want some options for sorting by memory vs CPU eventually?
  processList.sort((a, b) => {
    return Number(b.cpuPercentage) - Number(a.cpuPercentage);
  });

  return {
    cpu: {
      userPercentage: cpu?.[1] ?? "?",
      systemPercentage: cpu?.[2] ?? "?",
      idlePercentage: cpu?.[3] ?? "?",
    },
    memory: {
      usedMemory: mem?.[1] ?? "?",
      wiredMemory: mem?.[2] ?? "?",
      unusedMemory: mem?.[3] ?? "?",
    },
    processes: processList,
  };
}
