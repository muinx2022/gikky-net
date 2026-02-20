"use client";

import { useState, useEffect } from "react";
import { Title, Text, Box, Paper, Badge, Group, Button, LoadingOverlay, SimpleGrid, Divider } from "@mantine/core";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { strapiApi } from "../../../../lib/strapi";
import { useRouter, useParams } from "next/navigation";
import AdminCommentList from "../../../../components/AdminCommentList";

interface Trade {
  id: number;
  documentId: string;
  symbol: string;
  market: string;
  direction: "long" | "short";
  outcome: "win" | "loss" | "breakeven" | "open";
  pnl?: number | null;
  isPublic?: boolean;
  entryDate: string;
  exitDate?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  quantity?: number | null;
  strategy?: string | null;
  setup?: string | null;
  notes?: string | null;
  author?: {
    id: number;
    username?: string;
    email?: string;
  } | null;
}

export default function ViewJournalTradePage() {
  const router = useRouter();
  const params = useParams();
  const tradeId = params.id as string;

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tradeId) fetchTrade();
  }, [tradeId]);

  const fetchTrade = async () => {
    try {
      const response = await strapiApi.get(`/api/admin-journals/${tradeId}`);
      setTrade(response.data?.data || null);
    } catch (error) {
      console.error("Failed to fetch trade:", error);
      alert("Failed to load trade");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const outcomeColor = trade
    ? trade.outcome === "win"
      ? "green"
      : trade.outcome === "loss"
        ? "red"
        : "gray"
    : "gray";

  return (
    <Box>
      <Group justify="space-between" mb="xl">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<ArrowLeft size={18} />}
          onClick={() => router.back()}
        >
          Back
        </Button>
      </Group>

      <Paper shadow="xs" p="xl" radius="lg" style={{ border: "1px solid #e2e8f0", position: "relative" }}>
        <LoadingOverlay visible={loading} />

        {trade && (
          <Box>
            {/* Header */}
            <Group gap="sm" mb="xl" align="center">
              <Title order={2} c="#0f172a">
                {trade.symbol}
              </Title>
              <Badge variant="light" color={outcomeColor} size="lg" radius="sm">
                {trade.outcome}
              </Badge>
              <Badge variant="outline" color="gray" size="md" radius="sm">
                {trade.direction?.toUpperCase()}
              </Badge>
              {trade.isPublic ? (
                <Badge variant="light" color="green" size="sm">Public</Badge>
              ) : (
                <Badge variant="light" color="gray" size="sm">Private</Badge>
              )}
            </Group>

            {/* Trade details grid */}
            <SimpleGrid cols={3} spacing="md" mb="xl">
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Market</Text>
                <Text size="sm">{trade.market}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>P&amp;L</Text>
                <Text
                  size="sm"
                  fw={600}
                  c={trade.pnl == null ? "dimmed" : trade.pnl >= 0 ? "green" : "red"}
                >
                  {trade.pnl == null ? "-" : Number(trade.pnl).toFixed(2)}
                </Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Quantity</Text>
                <Text size="sm">{trade.quantity ?? "-"}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Entry Price</Text>
                <Text size="sm">{trade.entryPrice ?? "-"}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Exit Price</Text>
                <Text size="sm">{trade.exitPrice ?? "-"}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Author</Text>
                <Text size="sm">{trade.author?.username || trade.author?.email || "Unknown"}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Entry Date</Text>
                <Text size="sm">{formatDate(trade.entryDate)}</Text>
              </Box>
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={2}>Exit Date</Text>
                <Text size="sm">{trade.exitDate ? formatDate(trade.exitDate) : "-"}</Text>
              </Box>
            </SimpleGrid>

            {trade.strategy && (
              <Box mb="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>Strategy</Text>
                <Text size="sm">{trade.strategy}</Text>
              </Box>
            )}

            {trade.setup && (
              <Box mb="md">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>Setup</Text>
                <Text size="sm">{trade.setup}</Text>
              </Box>
            )}

            {trade.notes && (
              <Box>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>Notes</Text>
                <Box
                  p="md"
                  style={{
                    background: "#f8fafc",
                    borderRadius: 6,
                    border: "1px solid #e2e8f0",
                    maxHeight: 300,
                    overflowY: "auto",
                  }}
                >
                  <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{trade.notes}</Text>
                </Box>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Comments Section */}
      {trade && (
        <Paper shadow="xs" p="xl" radius="lg" mt="lg" style={{ border: "1px solid #e2e8f0" }}>
          <Group gap="xs" mb="lg">
            <MessageSquare size={18} color="#64748b" />
            <Title order={3} c="#0f172a">Comments</Title>
          </Group>
          <Divider mb="md" />
          <AdminCommentList journalTradeId={trade.documentId} />
        </Paper>
      )}
    </Box>
  );
}
