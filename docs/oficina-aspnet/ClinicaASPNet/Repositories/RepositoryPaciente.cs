using ClinicaASPNet.Data;
using ClinicaASPNet.Models;

namespace ClinicaASPNet.Repositories
{
    public class RepositoryPaciente : RepositoryBase<Paciente>
    {
        public RepositoryPaciente(ClinicaDbContext context) : base(context)
        {
            
        }

        public bool CpfJaCadastrado(string cpf, int? ignorarId = null)
        {
            IEnumerable<Paciente> _pacientes = this.ListarTodos();
            return _pacientes.Any(x => x.Cpf == cpf && x.Id != ignorarId);
        }

        public IEnumerable<Paciente> Listar(string? nome = null)
        {
            IEnumerable<Paciente> consulta = this.ListarTodos();
            if (!string.IsNullOrWhiteSpace(nome))
            {
                consulta = consulta.Where(p => p.Nome.Contains(nome,
                    StringComparison.OrdinalIgnoreCase));
            }
            return consulta.OrderBy(p => p.Nome);

        }
    }
}
