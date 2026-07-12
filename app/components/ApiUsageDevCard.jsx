import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { clearApiRequestCaches } from "../services/apiRequestCaches";
import {
  getApiUsageSnapshot,
  resetApiUsage,
  subscribeToApiUsage,
} from "../services/apiUsageTracker";

export default function ApiUsageDevCard() {
  const [expanded, setExpanded] = useState(false);
  const [rows, setRows] = useState(getApiUsageSnapshot());
  useEffect(
    () => subscribeToApiUsage(() => setRows(getApiUsageSnapshot())),
    [],
  );
  if (!__DEV__) return null;
  return (
    <View className="mt-4 rounded-2xl border border-white/20 bg-black/20 p-4">
      <Pressable onPress={() => setExpanded((value) => !value)}>
        <Text className="font-bold text-white">
          API usage {expanded ? "−" : "+"}
        </Text>
      </Pressable>
      {expanded && (
        <View className="mt-3 gap-2">
          {rows.length === 0 ? (
            <Text className="text-xs text-white/70">No session activity.</Text>
          ) : (
            rows.map((row) => (
              <Text
                key={`${row.provider}:${row.operation}`}
                className="text-xs text-white/80"
              >
                {row.provider} · {row.operation}: {row.operations} operations,{" "}
                {row.started} started, {row.succeeded} ok, {row.failed} failed,{" "}
                {row.cacheHits} cached, {row.inFlightDeduplicated} shared,{" "}
                {row.currentInFlight} active
              </Text>
            ))
          )}
          <View className="mt-2 flex-row gap-2">
            <Pressable
              onPress={resetApiUsage}
              className="rounded-lg bg-white px-3 py-2"
            >
              <Text className="text-xs font-semibold text-stone-900">
                Reset Session Counts
              </Text>
            </Pressable>
            <Pressable
              onPress={clearApiRequestCaches}
              className="rounded-lg bg-white px-3 py-2"
            >
              <Text className="text-xs font-semibold text-stone-900">
                Clear Caches
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
