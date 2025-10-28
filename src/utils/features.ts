// SPDX-FileCopyrightText: Copyright 2025 New Vector Ltd.
//
// SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial

import { type QueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { parse, gte } from "semver";

import { versionQuery } from "@/api/mas";

type SemverString =
  | `v${number}.${number}.${number}`
  | `v${number}.${number}.${number}-${string}`;

const masFeaturesMinVersions = {
  personalTokens: "v1.5.0-rc.0",
} as const satisfies Record<string, SemverString>;

type MasFeature = keyof typeof masFeaturesMinVersions;

export type MasFeaturesStatus = Record<MasFeature, boolean>;

const computeFeaturesStatus = (version: string): MasFeaturesStatus => {
  const semver = parse(version, {}, true);

  return Object.fromEntries(
    Object.entries(masFeaturesMinVersions).map(([feature, minVersion]) => [
      feature,
      gte(semver, minVersion),
    ]),
  ) as MasFeaturesStatus;
};

/**
 * A hook to get the availability of all the features on the given server
 *
 * @param serverName The server name to which the query is sent
 * @returns A record indicating which features are available
 */
export const useFeaturesStatus = (serverName: string): MasFeaturesStatus => {
  const {
    data: { version },
  } = useSuspenseQuery(versionQuery(serverName));
  const featuresStatus = useMemo(
    () => computeFeaturesStatus(version),
    [version],
  );
  return featuresStatus;
};

/**
 * Get the availability of all the features on the given server
 *
 * @param queryClient The Tanstack Query client to use
 * @param serverName The server name to which the query is sent
 * @returns A record indicating which features are available
 */
export const getFeaturesStatus = async (
  queryClient: QueryClient,
  serverName: string,
): Promise<MasFeaturesStatus> => {
  const { version } = await queryClient.ensureQueryData(
    versionQuery(serverName),
  );
  return computeFeaturesStatus(version);
};
