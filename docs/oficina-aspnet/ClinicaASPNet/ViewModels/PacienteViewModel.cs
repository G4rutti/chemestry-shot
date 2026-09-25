using ClinicaASPNet.Data;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Runtime.CompilerServices;

namespace ClinicaASPNet.ViewModels
{

    public class PacienteViewModel
    {
        public int Id { get; set; }

        [Required(ErrorMessage = "Campo Obrigatótio")]
        [StringLength(100, MinimumLength = 3,
            ErrorMessage = "O Nome deve possuir entre 3 e 100 Caracteres")]
        [Display(Name = "Nome Completo")]
        public string Nome { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")]
        [RegularExpression(@"^\d{11}$", ErrorMessage = "Informe o cpf com 11 dígitos")]
        public string Cpf { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")]
        [Phone(ErrorMessage = "Informe um telefone válido")]
        public string Telefone { get; set; } = string.Empty;

        [Required(ErrorMessage = "Campo obrigatório")]
        [DataType(DataType.Date)]
        [Display(Name = "Data de Nascimento")]
        public DateTime DataNascimento { get; set; }

        public int Idade { get; set; }

        public PacienteViewModel()
        {
                
        }

        public static async Task<PacienteViewModel> SelecionarPorId(
            ClinicaDbContext db, int id)
        {
            var paciente = await db.Pacientes.FirstAsync(p =>p.Id == id);
            if (paciente is null) return null;

            var pacienteViewModel = new PacienteViewModel()
            {
                Cpf = paciente.Cpf,
                Id = paciente.Id,
                Nome = paciente.Nome,
                Telefone = paciente.Telefone,
                DataNascimento = paciente.DataNascimento,
                Idade = DateTime.Now.Year - paciente.DataNascimento.Year,
            };
            return  pacienteViewModel;
            
        }
        public static async Task<List<PacienteViewModel>> ListarTodos(
            ClinicaDbContext db, string nome = "")

        {
             //cria o contexto para podermos acessar o banco de dados  
           
            //cria a lista de retorno  
            var listaPacientesVM = new List<PacienteViewModel>();
            //cria uma lista com todos os pacientes cadastrados no banco
            var pacientes = await  db.Pacientes.ToListAsync();
            if (!nome.IsWhiteSpace())
                pacientes = pacientes.Where(p => p.Nome.Contains(nome)).ToList();
           
            foreach (var paciente in pacientes)
            {
                listaPacientesVM.Add(new PacienteViewModel()
                {
                    Cpf = paciente.Cpf,
                    Id = paciente.Id,
                    Nome = paciente.Nome,
                    Telefone = paciente.Telefone,
                    DataNascimento = paciente.DataNascimento,
                    Idade = DateTime.Now.Year - paciente.DataNascimento.Year,

                });                              
            }
            return listaPacientesVM;



        }


    }
}
