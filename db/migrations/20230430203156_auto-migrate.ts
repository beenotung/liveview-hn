import { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cache', table => {
    table.setNullable('data')
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cache', table => {
    table.dropNullable('data')
  })
}
