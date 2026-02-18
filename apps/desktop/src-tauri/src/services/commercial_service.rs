//! Commercial Service
//!
//! Business logic for clients and pricing.

use manchengo_core::{EntityId, Error, Result};
use manchengo_database::Database;
use manchengo_sync::EventStore;
use std::sync::Arc;
use tracing::info;

use crate::dto::commercial::*;
use crate::repositories::ClientRepository;

/// Commercial service for client management
pub struct CommercialService {
    db: Arc<Database>,
    event_store: Arc<EventStore>,
    client_repo: Arc<ClientRepository>,
}

impl CommercialService {
    pub fn new(
        db: Arc<Database>,
        event_store: Arc<EventStore>,
        client_repo: Arc<ClientRepository>,
    ) -> Self {
        Self {
            db,
            event_store,
            client_repo,
        }
    }

    // =========================================================================
    // CLIENT OPERATIONS
    // =========================================================================

    /// List clients
    pub fn list_clients(&self, filter: ClientFilter) -> Result<Vec<ClientDto>> {
        self.client_repo.list(filter)
    }

    /// Get single client
    pub fn get_client(&self, id: &str) -> Result<Option<ClientDto>> {
        self.client_repo.get(id)
    }

    /// Create new client
    pub fn create_client(&self, data: CreateClientDto) -> Result<ClientDto> {
        let id = EntityId::new().to_string();
        let code = self.client_repo.generate_code()?;

        self.client_repo.create(&id, &code, &data)?;

        info!("Created client {} ({})", data.name, code);

        self.client_repo
            .get(&id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Client".to_string(),
                id: id.clone(),
            })
    }

    /// Update client
    pub fn update_client(&self, id: &str, data: CreateClientDto) -> Result<ClientDto> {
        self.client_repo.update(id, &data)?;

        info!("Updated client {}", id);

        self.client_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Client".to_string(),
                id: id.to_string(),
            })
    }

    /// Delete client
    pub fn delete_client(&self, id: &str) -> Result<()> {
        self.client_repo.delete(id)?;
        info!("Deleted client {}", id);
        Ok(())
    }

    /// Get client balance
    pub fn get_client_balance(&self, id: &str) -> Result<ClientBalanceDto> {
        let client = self
            .client_repo
            .get(id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Client".to_string(),
                id: id.to_string(),
            })?;

        let available_credit = client.credit_limit - client.current_balance;

        // TODO: Count outstanding and overdue invoices
        let outstanding_invoices = 0;
        let overdue_invoices = 0;

        Ok(ClientBalanceDto {
            client_id: client.id,
            client_name: client.name,
            current_balance: client.current_balance,
            credit_limit: client.credit_limit,
            available_credit,
            outstanding_invoices,
            overdue_invoices,
        })
    }

    /// Get client history
    pub fn get_client_history(&self, id: &str, limit: Option<u32>) -> Result<Vec<ClientHistoryItemDto>> {
        let _limit = limit.unwrap_or(50);

        // TODO: Query invoices and payments for this client
        // For now, return empty history
        Ok(Vec::new())
    }

    // =========================================================================
    // PRICE LIST OPERATIONS
    // =========================================================================

    /// List price lists
    pub fn list_price_lists(&self, active_only: bool) -> Result<Vec<PriceListDto>> {
        self.db.with_connection(|conn| {
            let mut sql = String::from(
                "SELECT id, name, code, is_default, discount_percentage, is_active,
                        valid_from, valid_to, created_at
                 FROM price_lists
                 WHERE is_deleted = 0",
            );

            if active_only {
                sql.push_str(" AND is_active = 1");
            }

            sql.push_str(" ORDER BY is_default DESC, name ASC");

            let mut stmt = conn.prepare(&sql).map_err(|e| Error::Database(e.to_string()))?;

            let lists = stmt
                .query_map([], |row| {
                    Ok(PriceListDto {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        code: row.get(2)?,
                        is_default: row.get(3)?,
                        discount_percentage: row.get(4)?,
                        is_active: row.get(5)?,
                        valid_from: row.get(6)?,
                        valid_to: row.get(7)?,
                        items: Vec::new(), // Populated separately if needed
                        created_at: row.get(8)?,
                    })
                })
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for list in lists {
                result.push(list.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }

    /// Get prices for a client
    pub fn get_client_prices(&self, client_id: &str) -> Result<Vec<ClientPriceDto>> {
        let _client = self
            .client_repo
            .get(client_id)?
            .ok_or_else(|| Error::NotFound {
                entity_type: "Client".to_string(),
                id: client_id.to_string(),
            })?;

        // Get default price list
        let price_lists = self.list_price_lists(true)?;
        let default_list = price_lists.iter().find(|l| l.is_default);

        self.db.with_connection(|conn| {
            let mut stmt = conn
                .prepare(
                    "SELECT pf.id, pf.name, pf.code, pf.price_ht
                     FROM products_pf pf
                     WHERE pf.is_deleted = 0 AND pf.is_active = 1
                     ORDER BY pf.name",
                )
                .map_err(|e| Error::Database(e.to_string()))?;

            let products = stmt
                .query_map([], |row| {
                    let base_price: i64 = row.get(3)?;
                    let discount = default_list
                        .as_ref()
                        .map(|l| l.discount_percentage)
                        .unwrap_or(0.0);
                    let client_price = (base_price as f64 * (1.0 - discount / 100.0)) as i64;

                    Ok(ClientPriceDto {
                        product_pf_id: row.get(0)?,
                        product_pf_name: row.get(1)?,
                        product_pf_code: row.get(2)?,
                        base_price,
                        client_price,
                        discount_percentage: discount,
                        price_list_name: default_list.as_ref().map(|l| l.name.clone()),
                    })
                })
                .map_err(|e| Error::Database(e.to_string()))?;

            let mut result = Vec::new();
            for product in products {
                result.push(product.map_err(|e| Error::Database(e.to_string()))?);
            }
            Ok(result)
        })
    }
}
