using ClinicaASPNet.Data;
using ClinicaASPNet.Models;
using ClinicaASPNet.Repositories;
using ClinicaASPNet.ViewModels;

namespace ClinicaASPNet.Services
{
    public class EspecialidadeService
    {

        private readonly ClinicaDbContext _context;
        private readonly RepositoryEspecialidade _repository;

        public EspecialidadeService(ClinicaDbContext context)
        {
            _context = context;
            _repository = new RepositoryEspecialidade(context);
        }

        public async Task<IReadOnlyList<Especialidade>> ListarTodosAsync()
        {
            return await _repository.ListarTodosAsync();
        }

        public async Task<Especialidade> SelecionarAsync(int id)
        {
            return await _repository.SelecionarPorIdAsync(id);
        }

        public async Task<bool> ExcluirAsync(int id)
        {
            var especialidade = await _repository.SelecionarPorIdAsync(id);
            if (especialidade != null)
            {
                await _repository.ExcluirAsync(especialidade);
                return true;
            }
            return false;
        }

        public async Task AdicionarAsync(EspecialidadeViewModel especialidadeVM)
        {
            var especialidade = new Especialidade()
            {
                Descricao = especialidadeVM.Descricao,
                Nome = especialidadeVM.Nome,

            };
            await _repository.IncluirAsync(especialidade);
        }

        public async Task EditarAsync(EspecialidadeViewModel especialidadeVM)
        {
            var especialidade = new Especialidade()
            {
                Descricao = especialidadeVM.Descricao,
                Nome = especialidadeVM.Nome,
                Id = especialidadeVM.Id
            };

            await _repository.AlterarAsync(especialidade);
        }



    }
}
