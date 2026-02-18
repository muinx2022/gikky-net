"use client";

import { useEffect, useMemo, useState } from "react";
import { Anchor, Badge, Box, Button, Group, Menu, Modal, Paper, Select, SimpleGrid, Switch, Table, Text, TextInput, Title } from "@mantine/core";
import { MoreVertical, Trash, Eye } from "lucide-react";
import { notifications } from "@mantine/notifications";
import { strapiApi } from "../../../lib/strapi";
import DeleteConfirmModal from "../../../components/DeleteConfirmModal";

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
  author?: {
    id: number;
    username?: string;
    email?: string;
  } | null;
  strategy?: string | null;
  setup?: string | null;
  notes?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  quantity?: number | null;
  exitDate?: string | null;
}

const MARKET_OPTIONS = [
  { value: "", label: "All markets" },
  { value: "crypto", label: "Crypto" },
  { value: "forex", label: "Forex" },
  { value: "stock", label: "Stock" },
  { value: "futures", label: "Futures" },
  { value: "other", label: "Other" },
];

const OUTCOME_OPTIONS = [
  { value: "", label: "All outcomes" },
  { value: "win", label: "Win" },
  { value: "loss", label: "Loss" },
  { value: "breakeven", label: "Breakeven" },
  { value: "open", label: "Open" },
];

const PUBLIC_OPTIONS = [
  { value: "", label: "All" },
  { value: "true", label: "Public" },
  { value: "false", label: "Private" },
];

export default function JournalTradesPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    symbol: "",
    market: "",
    outcome: "",
    isPublic: "",
  });
  const [deleteModalOpened, setDeleteModalOpened] = useState(false);
  const [deletingTrade, setDeletingTrade] = useState<{ id: string; symbol: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewModalOpened, setViewModalOpened] = useState(false);
  const [viewLoading, setViewLoading] = useState(false);
  const [viewTrade, setViewTrade] = useState<Trade | null>(null);

  const fetchTrades = async () => {
    setLoading(true);
    try {
      const nextFilters: Record<string, unknown> = {};
      if (filters.symbol.trim()) nextFilters.symbol = { $containsi: filters.symbol.trim() };
      if (filters.market) nextFilters.market = { $eq: filters.market };
      if (filters.outcome) nextFilters.outcome = { $eq: filters.outcome };
      if (filters.isPublic) nextFilters.isPublic = { $eq: filters.isPublic === "true" };

      const response = await strapiApi.get("/api/admin-journals", {
        params: {
          filters: nextFilters,
        },
      });

      setTrades(response.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch journal trades", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch journal trades",
        color: "red",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrades();
  }, [filters.symbol, filters.market, filters.outcome, filters.isPublic]);

  const openDeleteModal = (documentId: string, symbol: string) => {
    setDeletingTrade({ id: documentId, symbol });
    setDeleteModalOpened(true);
  };

  const handleDelete = async () => {
    if (!deletingTrade) return;
    setDeleting(true);
    try {
      await strapiApi.delete(`/api/admin-journals/${deletingTrade.id}`);
      notifications.show({
        title: "Success",
        message: "Journal trade deleted",
        color: "green",
      });
      setDeleteModalOpened(false);
      setDeletingTrade(null);
      await fetchTrades();
    } catch (error) {
      console.error("Failed to delete journal trade", error);
      notifications.show({
        title: "Error",
        message: "Failed to delete journal trade",
        color: "red",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePublic = async (trade: Trade, nextValue: boolean) => {
    try {
      await strapiApi.put(`/api/admin-journals/${trade.documentId}`, {
        data: { isPublic: nextValue },
      });
      setTrades((prev) => prev.map((item) => (item.documentId === trade.documentId ? { ...item, isPublic: nextValue } : item)));
    } catch (error) {
      console.error("Failed to update public status", error);
      notifications.show({
        title: "Error",
        message: "Failed to update public status",
        color: "red",
      });
    }
  };

  const openViewModal = async (trade: Trade) => {
    if (!trade.isPublic) return;
    setViewModalOpened(true);
    setViewLoading(true);
    try {
      const response = await strapiApi.get(`/api/admin-journals/${trade.documentId}`);
      setViewTrade(response.data?.data || null);
    } catch (error) {
      console.error("Failed to fetch trade detail", error);
      notifications.show({
        title: "Error",
        message: "Failed to fetch trade detail",
        color: "red",
      });
      setViewModalOpened(false);
    } finally {
      setViewLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const rows = useMemo(
    () =>
      trades.map((trade) => (
        <Table.Tr key={trade.documentId}>
          <Table.Td>
            <Anchor
              component="button"
              type="button"
              fw={600}
              onClick={() => openViewModal(trade)}
              disabled={!trade.isPublic}
              c={!trade.isPublic ? "dimmed" : undefined}
              style={{
                textDecoration: "none",
                cursor: trade.isPublic ? "pointer" : "not-allowed",
              }}
            >
              {trade.symbol}
            </Anchor>
            <Text size="xs" c="dimmed">{trade.direction?.toUpperCase()} · {trade.market}</Text>
          </Table.Td>
          <Table.Td style={{ width: 210 }}>
            <Group gap={8}>
              <Badge variant="light" color={trade.outcome === "win" ? "green" : trade.outcome === "loss" ? "red" : "gray"}>
                {trade.outcome}
              </Badge>
              <Text size="sm">P&amp;L: {trade.pnl == null ? "-" : Number(trade.pnl).toFixed(2)}</Text>
            </Group>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{trade.author?.username || trade.author?.email || "Unknown"}</Text>
            <Text size="xs" c="dimmed">{formatDate(trade.entryDate)}</Text>
          </Table.Td>
          <Table.Td style={{ width: 90, textAlign: "center" }}>
            <Switch
              checked={Boolean(trade.isPublic)}
              onChange={(event) => handleTogglePublic(trade, event.currentTarget.checked)}
              color="green"
            />
          </Table.Td>
          <Table.Td>
            <Group gap={6} justify="flex-end">
              <Button
                size="xs"
                variant="light"
                leftSection={<Eye size={14} />}
                disabled={!trade.isPublic}
                onClick={() => openViewModal(trade)}
              >
                View
              </Button>
              <Menu shadow="md" width={180} position="bottom-end">
                <Menu.Target>
                  <Button variant="subtle" px={8}>
                    <MoreVertical size={16} />
                  </Button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item color="red" leftSection={<Trash size={14} />} onClick={() => openDeleteModal(trade.documentId, trade.symbol)}>
                    Delete
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          </Table.Td>
        </Table.Tr>
      )),
    [trades]
  );

  return (
    <Box>
      <Group justify="space-between" mb="lg">
        <div>
          <Title order={2}>Journal Trades</Title>
          <Text c="dimmed" size="sm">Manage public/private trade journals and moderate content</Text>
        </div>
      </Group>

      <Paper withBorder p="md" radius="md" mb="md">
        <Group align="end" grow>
          <TextInput
            label="Symbol"
            placeholder="Search by symbol"
            value={filters.symbol}
            onChange={(event) => setFilters((prev) => ({ ...prev, symbol: event.currentTarget.value }))}
          />
          <Select
            label="Market"
            data={MARKET_OPTIONS}
            value={filters.market}
            onChange={(value) => setFilters((prev) => ({ ...prev, market: value || "" }))}
          />
          <Select
            label="Outcome"
            data={OUTCOME_OPTIONS}
            value={filters.outcome}
            onChange={(value) => setFilters((prev) => ({ ...prev, outcome: value || "" }))}
          />
          <Select
            label="Visibility"
            data={PUBLIC_OPTIONS}
            value={filters.isPublic}
            onChange={(value) => setFilters((prev) => ({ ...prev, isPublic: value || "" }))}
          />
        </Group>
      </Paper>

      <Paper withBorder radius="md" p="sm">
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover verticalSpacing="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Trade</Table.Th>
                <Table.Th style={{ width: 210 }}>Kết quả</Table.Th>
                <Table.Th>Tác giả</Table.Th>
                <Table.Th style={{ width: 90, textAlign: "center" }}>Public</Table.Th>
                <Table.Th style={{ textAlign: "right" }}>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.length > 0 ? rows : (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="lg">{loading ? "Loading..." : "No journal trades found"}</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Paper>

      <DeleteConfirmModal
        opened={deleteModalOpened}
        onClose={() => {
          if (deleting) return;
          setDeleteModalOpened(false);
          setDeletingTrade(null);
        }}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete journal trade"
        message={`Are you sure you want to delete "${deletingTrade?.symbol || "this trade"}"?`}
      />

      <Modal
        opened={viewModalOpened}
        onClose={() => {
          if (viewLoading) return;
          setViewModalOpened(false);
          setViewTrade(null);
        }}
        title="Chi tiết trade journal"
        centered
        size="lg"
      >
        {viewLoading ? (
          <Text size="sm" c="dimmed">Loading...</Text>
        ) : !viewTrade ? (
          <Text size="sm" c="dimmed">Không có dữ liệu.</Text>
        ) : (
          <Box>
            <SimpleGrid cols={2} spacing="sm" mb="md">
              <Text size="sm"><b>Symbol:</b> {viewTrade.symbol}</Text>
              <Text size="sm"><b>Market:</b> {viewTrade.market}</Text>
              <Text size="sm"><b>Direction:</b> {viewTrade.direction}</Text>
              <Text size="sm"><b>Outcome:</b> {viewTrade.outcome}</Text>
              <Text size="sm"><b>P&amp;L:</b> {viewTrade.pnl == null ? "-" : Number(viewTrade.pnl).toFixed(2)}</Text>
              <Text size="sm"><b>Quantity:</b> {viewTrade.quantity ?? "-"}</Text>
              <Text size="sm"><b>Entry Price:</b> {viewTrade.entryPrice ?? "-"}</Text>
              <Text size="sm"><b>Exit Price:</b> {viewTrade.exitPrice ?? "-"}</Text>
              <Text size="sm"><b>Entry Date:</b> {formatDate(viewTrade.entryDate)}</Text>
              <Text size="sm"><b>Exit Date:</b> {viewTrade.exitDate ? formatDate(viewTrade.exitDate) : "-"}</Text>
              <Text size="sm"><b>Tác giả:</b> {viewTrade.author?.username || viewTrade.author?.email || "Unknown"}</Text>
              <Text size="sm"><b>Trạng thái:</b> {viewTrade.isPublic ? "Public" : "Private"}</Text>
            </SimpleGrid>

            <Box mb="sm">
              <Text fw={600} size="sm" mb={4}>Strategy</Text>
              <Text size="sm" c="dimmed">{viewTrade.strategy || "-"}</Text>
            </Box>

            <Box mb="sm">
              <Text fw={600} size="sm" mb={4}>Setup</Text>
              <Text size="sm" c="dimmed">{viewTrade.setup || "-"}</Text>
            </Box>

            <Box>
              <Text fw={600} size="sm" mb={4}>Notes</Text>
              <Text size="sm" c="dimmed" style={{ whiteSpace: "pre-wrap" }}>{viewTrade.notes || "-"}</Text>
            </Box>
          </Box>
        )}
      </Modal>
    </Box>
  );
}


