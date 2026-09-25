using ClinicaASPNet.Models;
using Microsoft.EntityFrameworkCore;

namespace ClinicaASPNet.Data
{
    public class ClinicaDbContext : DbContext
    {
        public ClinicaDbContext(DbContextOptions<ClinicaDbContext> options) : base(options)
        {

        }



        public DbSet<Paciente> Pacientes => Set<Paciente>();
        public DbSet<Profissional> Profissionais => Set<Profissional>();
        public DbSet<Especialidade> Especialidades => Set<Especialidade>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Especialidade>(entity =>
            {
                entity.ToTable("Especialidades");
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Nome)
                .HasMaxLength(100)
                .IsRequired();
                entity.Property(e => e.Descricao)
                .HasMaxLength(300)
                .IsRequired();
                entity.HasIndex(e => e.Nome).IsUnique();
            });




            modelBuilder.Entity<Profissional>(
                entity =>
                {
                    entity.ToTable("Profissionais");
                    entity.HasKey(p => p.Id);
                    entity.Property(p => p.Nome)
                    .HasMaxLength(100)
                    .IsRequired();
                    entity.Property(p => p.RegistroProfissional)
                    .HasMaxLength(30)
                    .IsRequired();

                    entity.Property(p => p.Telefone)
                    .HasMaxLength(20)
                    .IsRequired();

                    entity.HasIndex(p => p.RegistroProfissional).IsUnique();

                    entity.HasMany(p => p.Especialidades)
                        .WithMany(e => e.Profissionais)
                        .UsingEntity<Dictionary<string, object>>("ProfissionalEspecialidade", direita => direita
                        .HasOne<Especialidade>()
                        .WithMany()
                        .HasForeignKey("EspecialidadeId")
                        .OnDelete(DeleteBehavior.Cascade),
                        esquerda => esquerda
                        .HasOne<Profissional>()
                        .WithMany()
                        .HasForeignKey("ProfissionalId")
                        .OnDelete(DeleteBehavior.Cascade),
                        associacao =>
                        {
                            associacao.ToTable("ProfissionalEspecialidades");
                            associacao.HasKey("ProfissionalId", "EspecialidadeId");
                        }
                        );


                }
                );
            modelBuilder.Entity<Paciente>(
                entity =>
                {
                    entity.ToTable("Pacientes");
                    entity.HasKey(p => p.Id);
                    entity.Property(p => p.Nome)
                    .HasMaxLength(100)
                    .IsRequired();
                    entity.Property(p => p.Cpf)
                    .HasColumnType("varchar(100)")
                    .IsRequired();
                    entity.HasIndex(p => p.Cpf)
                    .IsUnique();
                    entity.Property(p => p.Telefone)
                     .HasMaxLength(100)
                      .IsRequired();
                    entity.Property(p => p.DataNascimento)
                    .HasColumnType("date");
                    entity.Property(p => p.CriadoEm)
                    .HasColumnType("datetime2");
                    entity.Property(p => p.AtualizadoEm)
                   .HasColumnType("datetime2");

                }


                );

        }
    }
}
