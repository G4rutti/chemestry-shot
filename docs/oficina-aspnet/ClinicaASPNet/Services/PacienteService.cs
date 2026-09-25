using ClinicaASPNet.Data;
using ClinicaASPNet.Models;
using ClinicaASPNet.Repositories;
using ClinicaASPNet.ViewModels;
using Microsoft.EntityFrameworkCore;

namespace ClinicaASPNet.Services
{
    public class PacienteService
    {
        private readonly ClinicaDbContext _context;

        private RepositoryPaciente _repositoryPaciente;

        public PacienteService(ClinicaDbContext context)
        {
            _context = context;
            _repositoryPaciente = new RepositoryPaciente(context);
        }

        public async Task InlcuirPacienteAsync(PacienteViewModel pacienteVM)
        {
            var paciente = new Paciente()
            {
                Cpf = pacienteVM.Cpf,
                DataNascimento = pacienteVM.DataNascimento,
                Nome = pacienteVM.Nome,
                Telefone = pacienteVM.Telefone,
            };
            await _repositoryPaciente.IncluirAsync(paciente);
        }

        public async Task EditarPacienteAsync(PacienteViewModel pacienteVM)
        {
            var paciente = new Paciente()
            {
                Cpf = pacienteVM.Cpf,
                DataNascimento = pacienteVM.DataNascimento,
                Nome = pacienteVM.Nome,
                Telefone = pacienteVM.Telefone,
                Id = pacienteVM.Id
            };
            await _repositoryPaciente.AlterarAsync(paciente);
        }

        public async Task<List<PacienteViewModel>> ListarTodosAsync(
            string nome= "")
       
        {
            return await PacienteViewModel.ListarTodos(_context, nome);
        }
       
        public async Task<PacienteViewModel> SelecionarPorIdAsync(int id) 
        {
            return await PacienteViewModel.SelecionarPorId(_context, id);
        }

        public async Task ExcluirAsync(int id)
        {
            var paciente = await _context.Pacientes.FirstAsync(p => p.Id == id);
            await _repositoryPaciente.ExcluirAsync(paciente);
        }

    }


}
