export const command = "marketplace";
export const desc = "Browse, install and publish Marketplace packages";

export function builder(yargs: any) {
  return yargs
    .command(
      "search",
      "Search the Marketplace for packages by category",
      (y: any) => {
        y.option("category", {
          type: "string",
          describe: "Filter by category",
        })
          .option("json", {
            type: "boolean",
            describe: "Output JSON",
          });
      },
    )
    .command(
      "install",
      "Install a Marketplace package",
      (y: any) => {
        y.positional("package", {
          type: "string",
          describe:
            "Package name and version, e.g. industrial_lasers@2.1.0",
        });
        y.option("json", {
          type: "boolean",
          describe: "Output JSON",
        });
      },
    )
    .command(
      "publish",
      "Publish a package to the Marketplace",
      (y: any) => {
        y.option("package", {
          type: "string",
          describe: "Directory containing the package (manifest.json + assets/)",
        });
        y.option("name", {
          type: "string",
          describe: "Package name",
        });
        y.option("version", {
          type: "string",
          describe: "Package version (semver)",
        });
        y.option("json", {
          type: "boolean",
          describe: "Output JSON",
        });
      },
    );
}
