using ClinicaASPNet.Data;
using ClinicaASPNet.Models;

namespace ClinicaASPNet.Repositories
{
    public class RepositoryEspecialidade : RepositoryBase<Especialidade>
    {
        public RepositoryEspecialidade(ClinicaDbContext context) : base(context) { }
                
        
    }
}
