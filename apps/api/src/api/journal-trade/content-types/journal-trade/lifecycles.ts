import { upsertJournalTradeToSearch, deleteJournalTradeFromSearch } from "../../../../utils/meili";

export default {
  async afterCreate(event: any) {
    try {
      const documentId = String(event?.result?.documentId || "");
      if (documentId) {
        await upsertJournalTradeToSearch(strapi, documentId);
      }
    } catch (error) {
      strapi.log.error("Failed to sync journal-trade to MeiliSearch after create", error);
    }
  },

  async afterUpdate(event: any) {
    try {
      const documentId = String(event?.result?.documentId || event?.params?.where?.documentId || "");
      if (documentId) {
        await upsertJournalTradeToSearch(strapi, documentId);
      }
    } catch (error) {
      strapi.log.error("Failed to sync journal-trade to MeiliSearch after update", error);
    }
  },

  async afterDelete(event: any) {
    try {
      const documentId = String(event?.result?.documentId || event?.params?.where?.documentId || "");
      if (documentId) {
        await deleteJournalTradeFromSearch(documentId);
      }
    } catch (error) {
      strapi.log.error("Failed to sync journal-trade to MeiliSearch after delete", error);
    }
  },
};
