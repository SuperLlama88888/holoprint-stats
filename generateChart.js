const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const fs = require("fs");
const path = require("path");
const { createClient: createSupabaseClient } = require("@supabase/supabase-js");

const outputImagePath = "usageGraph.png";
const csvFilePath = "dailyLogs.csv";
const jsonFilePath = "dailyLogs.json";

const graphFont = "xkcd-script";

const supabaseProjectUrl = "https://gnzyfffwvulwxbczqpgl.supabase.co";
const supabaseApiKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduenlmZmZ3dnVsd3hiY3pxcGdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwMjE3NzgsImV4cCI6MjAzODU5Nzc3OH0.AWMhFcP3PiMD3dMC_SeIVuPx128KVpgfkZ5qBStDuVw";

console.log(`Workflow triggered by ${process.env.GITHUB_EVENT_NAME}`);

let now = new Date();
let secondsAfterMidnight = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
if(process.env.GITHUB_EVENT_NAME == "workflow_dispatch" || (now.getUTCHours() != 23 && secondsAfterMidnight >= 60)) {
	updateChart();
} else {
	let secondsUntilOnePastMidnight = 60 - secondsAfterMidnight;
	if(secondsUntilOnePastMidnight < 0) {
		secondsUntilOnePastMidnight += 3600 * 24;
	}
	console.log(`Currently ${now.toTimeString()}; waiting ${secondsUntilOnePastMidnight} seconds before proceeding.`);
	setTimeout(updateChart, secondsUntilOnePastMidnight * 1000);
}

function updateChart() {
	let supabase = createSupabaseClient(supabaseProjectUrl, supabaseApiKey);
	supabase.from("daily_logs").select().then(async res => {
		if(res["status"] != 200) {
			throw new Error(`Failed to get daily logs: ${JSON.stringify(res)}`);
		}
		let data = res["data"];
		let labels = data.map(row => row["day"]);
		let structureCounts = data.map(row => row["structure_count"]);
		let packCounts = data.map(row => row["pack_count"]);
		
		let graphConfig = {
			type: "line",
			data: {
				labels,
				datasets: [
					{
						label: "Unique structure files",
						data: structureCounts,
						borderColor: "#D7B3D7",
						fill: false,
					},
					{
						label: "Total packs created",
						data: packCounts,
						borderColor: "#967896",
						fill: false,
					},
				],
			},
			options: {
				plugins: {
					title: {
						display: true,
						text: "Structure and Pack Count Over Time",
						font: {
							size: 25,
							family: graphFont
						}
					},
					legend: {
						labels: {
							boxHeight: 0,
							font: {
								family: graphFont
							}
						}
					}
				},
				scales: {
					x: {
						ticks: {
							font: {
								family: graphFont
							}
						}
					},
					y: {
						beginAtZero: true,
						ticks: {
							font: {
								family: graphFont
							}
						}
					}
				}
			}
		};
		
		const chartJSNodeCanvas = new ChartJSNodeCanvas({
			width: 800,
			height: 600,
			backgroundColour: "white"
		});
		chartJSNodeCanvas.registerFont("xkcd-script.ttf", {
			family: "xkcd-script"
		});
		
		const image = await chartJSNodeCanvas.renderToBuffer(graphConfig);
		
		fs.writeFileSync(path.join(__dirname, outputImagePath), image);
		console.log(`Chart has been saved as ${outputImagePath}`);
		
		let csvColumns = Object.keys(data[0] ?? {});
		let csvData = csvColumns.join(",");
		data.forEach(row => {
			csvData += "\n" + csvColumns.map(col => row[col]).join(",");
		});
		fs.writeFileSync(path.join(__dirname, csvFilePath), csvData);
		console.log(`CSV data log has been saved as ${csvFilePath}`);
		
		let jsonData = JSON.stringify(data);
		fs.writeFileSync(path.join(__dirname, jsonFilePath), jsonData);
		console.log(`JSON data log has been saved as ${jsonFilePath}`);
		
		process.exit(0);
	});
}