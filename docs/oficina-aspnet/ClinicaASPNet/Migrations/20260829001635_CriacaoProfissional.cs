using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicaASPNet.Migrations
{
    /// <inheritdoc />
    public partial class CriacaoProfissional : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Profissionais",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Nome = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: false),
                    CPF = table.Column<string>(type: "varchar(11)", nullable: false),
                    DataNascimento = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CRM = table.Column<string>(type: "TEXT", nullable: false),
                    Sexo = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Profissionais", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Profissionais_CPF",
                table: "Profissionais",
                column: "CPF",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Profissionais");
        }
    }
}
