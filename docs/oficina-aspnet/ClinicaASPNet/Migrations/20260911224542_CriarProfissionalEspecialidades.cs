using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ClinicaASPNet.Migrations
{
    /// <inheritdoc />
    public partial class CriarProfissionalEspecialidades : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Profissionais_CPF",
                table: "Profissionais");

            migrationBuilder.DropColumn(
                name: "CPF",
                table: "Profissionais");

            migrationBuilder.DropColumn(
                name: "CRM",
                table: "Profissionais");

            migrationBuilder.DropColumn(
                name: "DataNascimento",
                table: "Profissionais");

            migrationBuilder.DropColumn(
                name: "Sexo",
                table: "Profissionais");

            migrationBuilder.AlterColumn<string>(
                name: "Nome",
                table: "Profissionais",
                type: "TEXT",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "varchar(100)",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<string>(
                name: "RegistroProfissional",
                table: "Profissionais",
                type: "TEXT",
                maxLength: 30,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Telefone",
                table: "Profissionais",
                type: "TEXT",
                maxLength: 20,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Especialidades",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Nome = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Descricao = table.Column<string>(type: "TEXT", maxLength: 300, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Especialidades", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProfissionalEspecialidades",
                columns: table => new
                {
                    ProfissionalId = table.Column<int>(type: "INTEGER", nullable: false),
                    EspecialidadeId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProfissionalEspecialidades", x => new { x.ProfissionalId, x.EspecialidadeId });
                    table.ForeignKey(
                        name: "FK_ProfissionalEspecialidades_Especialidades_EspecialidadeId",
                        column: x => x.EspecialidadeId,
                        principalTable: "Especialidades",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProfissionalEspecialidades_Profissionais_ProfissionalId",
                        column: x => x.ProfissionalId,
                        principalTable: "Profissionais",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Profissionais_RegistroProfissional",
                table: "Profissionais",
                column: "RegistroProfissional",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Especialidades_Nome",
                table: "Especialidades",
                column: "Nome",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProfissionalEspecialidades_EspecialidadeId",
                table: "ProfissionalEspecialidades",
                column: "EspecialidadeId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProfissionalEspecialidades");

            migrationBuilder.DropTable(
                name: "Especialidades");

            migrationBuilder.DropIndex(
                name: "IX_Profissionais_RegistroProfissional",
                table: "Profissionais");

            migrationBuilder.DropColumn(
                name: "RegistroProfissional",
                table: "Profissionais");

            migrationBuilder.DropColumn(
                name: "Telefone",
                table: "Profissionais");

            migrationBuilder.AlterColumn<string>(
                name: "Nome",
                table: "Profissionais",
                type: "varchar(100)",
                maxLength: 100,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 100);

            migrationBuilder.AddColumn<string>(
                name: "CPF",
                table: "Profissionais",
                type: "varchar(11)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "CRM",
                table: "Profissionais",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<DateTime>(
                name: "DataNascimento",
                table: "Profissionais",
                type: "TEXT",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "Sexo",
                table: "Profissionais",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Profissionais_CPF",
                table: "Profissionais",
                column: "CPF",
                unique: true);
        }
    }
}
