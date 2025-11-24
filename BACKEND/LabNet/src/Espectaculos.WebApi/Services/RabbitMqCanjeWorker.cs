using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Configuration;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;
using MediatR;
using Espectaculos.Application.Beneficios.Commands.CreateBeneficio;
using Espectaculos.Application.Beneficios.Commands.UpdateBeneficio;
using Espectaculos.Application.Beneficios.Commands.CanjearBeneficio;
using Espectaculos.Application.Beneficios.Queries.ListBeneficios;
using Espectaculos.Application.Abstractions;
using Espectaculos.Application.Beneficios.Queries.GetBeneficioById;

namespace Espectaculos.WebApi.Services;



public class RabbitMqCanjeWorker : BackgroundService
{
    private readonly IConfiguration _config;
    private readonly ILogger<RabbitMqCanjeWorker> _logger;
    private readonly IServiceProvider _serviceProvider;

    public RabbitMqCanjeWorker(IConfiguration config, ILogger<RabbitMqCanjeWorker> logger, IServiceProvider serviceProvider)
    {
        _config = config;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
{
    var factory = new ConnectionFactory
    {
        HostName = "rabbitmq",
        Port = 5672,
        UserName = "admin",
        Password = "admin"
    };

    const string queueName = "beneficios.canjear";
    const string dlqName = "beneficios.canjear-dlq";

    var connection = factory.CreateConnection();
    var channel = connection.CreateModel();

    channel.QueueDeclare(
        dlqName,
        durable: true,
        exclusive: false,
        autoDelete: false
    );

    channel.QueueDeclare(
        queueName,
        durable: true,
        exclusive: false,
        autoDelete: false,
        arguments: new Dictionary<string, object>
        {
            { "x-dead-letter-exchange", "" },
            { "x-dead-letter-routing-key", dlqName }
        }
    );

    _logger.LogInformation("RabbitMqCanjeWorker iniciado y escuchando en la cola de canjes...");

    var consumer = new EventingBasicConsumer(channel);

    consumer.Received += async (_, ea) =>
    {
        if (stoppingToken.IsCancellationRequested)
        {
            _logger.LogInformation("Cancelando el procesamiento de mensajes...");
            channel.BasicNack(ea.DeliveryTag, false, true);
            return;
        }

        try
        {
            var json = Encoding.UTF8.GetString(ea.Body.ToArray());
            var message = JsonSerializer.Deserialize<CanjearBeneficioMessage>(json);

            if (message == null)
            {
                _logger.LogError("Formato de mensaje inválido");
                channel.BasicAck(ea.DeliveryTag, false);
                return;
            }

            _logger.LogInformation($"Procesando canje: BeneficioId={message.BeneficioId}, UsuarioId={message.UsuarioId}");

            using var scope = _serviceProvider.CreateScope();
            var mediator = scope.ServiceProvider.GetRequiredService<IMediator>();
            var uow = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

            var canjeExists = await uow.Canjes.ExistsAsync(
                x => x.BeneficioId == message.BeneficioId && x.UsuarioId == message.UsuarioId,
                stoppingToken
            );

            if (canjeExists)
            {
                _logger.LogWarning($"Canje ya existe: BeneficioId={message.BeneficioId}, UsuarioId={message.UsuarioId}");
                channel.BasicAck(ea.DeliveryTag, false);
                return;
            }

            var cmd = new CanjearBeneficioCommand(message.BeneficioId, message.UsuarioId);
            await mediator.Send(cmd, stoppingToken);

            _logger.LogInformation($"Canje exitoso: BeneficioId={message.BeneficioId}, UsuarioId={message.UsuarioId}");
            channel.BasicAck(ea.DeliveryTag, false);
        }
        catch (JsonException jsonEx)
        {
            _logger.LogError(jsonEx, "Error deserializando el mensaje");
            channel.BasicAck(ea.DeliveryTag, false);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error inesperado al procesar el mensaje");
            channel.BasicNack(ea.DeliveryTag, false, false);
        }
    };

    channel.BasicConsume(queueName, false, consumer);

    await Task.Delay(Timeout.Infinite, stoppingToken);
}
}